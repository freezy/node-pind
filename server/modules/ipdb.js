'use strict';

var _ = require('underscore');
var fs = require('fs');
var ent = require('ent');
var util = require('util');
var async = require('async');
var events = require('events');
var logger = require('winston');
var natural = require('natural');
var request = require('request');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var ipdb;
var an = require('./announce');
var hp = require('./hyperpin');

var isSyncing = false;

function Ipdb() {
	events.EventEmitter.call(this);
	this.initAnnounce();
	ipdb = this;
}
util.inherits(Ipdb, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 */
Ipdb.prototype.initAnnounce = function() {

	var ns = 'ipdb';

	// syncIPDB()
	an.data(this, 'processingStarted', { id: 'ipdbsync' }, ns, 'admin');
	an.data(this, 'processingCompleted', { id: 'ipdbsync' }, ns, 'admin');
	an.notice(this, 'processingCompleted', 'Finished matching IPDB.', 'admin', 5000);

	// enrichAll()
	an.notice(this, 'fetchingCompleted', 'Updating database with {{num}} data sets', 'admin', 30000);
	an.notice(this, 'updateCompleted', '{{num}} games updated, fetching top 300 games', 'admin', 30000);
	an.notice(this, 'top300Completed', 'Top 300 synced ({{num}} games).', 'admin', 30000);

	// enrich()
	an.notice(this, 'searchStarted', 'Searching for "{{name}}"', 'admin', 30000);

	// syncTop300()
	an.notice(this, 'top300Matched', 'Matched {{name}} ({{platform}}) at rank {{rank}}.', 'admin', 30000);
};

/**
 * Refreshes all tables that aren't of type 'OG' with info from ipdb.org.
 * @param callback Function to execute after completion, invoked with one argumens:
 * 	<ol><li>{String} Error message on error</li>
 *      <li>{Array} Updated tables</li></ol>
 */
Ipdb.prototype.syncIPDB = function(callback) {
	var that = this;
	if (isSyncing) {
		return callback('Syncing process already running. Wait until complete.');
	}
	that.emit('processingStarted');
	isSyncing = true;

	schema.Table.findAll( { where: [ 'type != ?', 'OG' ]}).success(function(rows) {

		// fetch data from ipdb.org
		that.enrichAll(rows, function(err, rows) {
			isSyncing = false;
			that.emit('processingCompleted');
			callback(err, rows);
		});

	}).error(callback);
};

/**
 * Performs a complete update from HyperPin and ipdb.org:
 *  <ol><li>Sync DB with HyperPin's XML "database"</li>
 * 		<li>Fetch additional metadata from ipdb.org for each table</li>
 * 		<li>Fetch top 300 list and update table rankings</li></ol>
 *
 * @param callback Function to execute after completion, invoked with one argumens:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
Ipdb.prototype.syncAll = function(callback) {
	var that = this;
	// sync with local database (aka HyperPin)
	hp.readTables(function(err, tables) {
		if (err) {
			return logger.log('error', '[ipdb] ' + err);
		}

		// fetch data from ipdb.org
		that.enrichAll(tables, callback);
	});
};

Ipdb.prototype.enrichAll = function(tables, callback) {
	var that = this;
	async.eachLimit(tables, 3, this.enrich, function(err) {

		if (err) {
			logger.log('error', '[ipdb] ' + err);
			return callback(err);
		}
		that.emit('fetchingCompleted', { num: tables.length });

		// update db
		async.eachSeries(tables, function(table, cb) {

			table.save().success(function(r) {
				cb(null, r);
			}).error(cb);

		}, function(err) {
			that.emit('updateCompleted', { num: tables.length });
			if (err) {
				logger.log('error', '[ipdb] ' + err);
				return callback(err);
			}

			logger.log('info', '[ipdb] %d games updated.', tables.length);

			// update ranking from top 300 list
			that.syncTop300(function(err, games) {
				if (err) {
					logger.log('error', '[ipdb] ' + err);
					callback(err);
				} else {
					that.emit('top300Completed', { num: games.length });
					logger.log('info', '[ipdb] Top 300 synced (%d games).', games.length);
					callback();
				}
			});
		});
	});
};

/**
 * Tries to find the pinball table on ipdb.org and adds additional metadata to
 * the given object if found (no database updates).
 *
 * Currently, we're pulling:
 * 	<ul><li>name - Name</li>
 * 	    <li>ipdb_no - ipdb.org number</li>
 * 	    <li>ipdb_mfg - ipdb.org manufacturer ID</li>
 * 	    <li>modelno - Model number</li>
 * 	    <li>rating - Rating</li>
 * 	    <li>short - Abbreviation</li>
 * 	    <li>units</li>
 * 	    <li>theme</li>
 * 	    <li>designer</li>
 * 	    <li>artist</li>
 * 	    <li>features</li>
 * 	    <li>notes</li>
 * 	    <li>toys</li>
 * 	    <li>slogans</li></ul>
 *
 * Note that games of type OG (original) are skipped directly, since ipdb.org
 * only contains real world machines.
 *
 * @param table Game from database. Must contain at least name.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} Updated table object</li></ol>
 */
Ipdb.prototype.enrich = function(table, callback) {

	var forceSearch = true;

	/**
	 * ipdb.org is quite picky about names and spelling errors etc will
	 * result in empty search results.
	 *
	 * This function fixes common spelling mistakes and name aberrations.
	 * @param n Original name from HyperPin
	 */
	var fixName = function(n) {

		var name = n + ' ';
		var r = function(needle, haystack) {
			name = name.replace(needle, haystack);
		};
		var rr = function(needle, replacment) {
			if (name.match(needle)) {
				name = replacment;
			}
		};

		// move ", the" to the start
		name = name.replace(/(.*),\s+(the)\s*/gi, '$2 $1 ');

		// common spelling errors
		r(/judgement day/i, 'judgment day');
		r(/ad+am+s family/i, 'addams family');

		// variations
		r(/high speed 2/i, 'high speed ii');
		r(/attack and revenge from mars/i, 'revenge from mars');
		r(/250cc/i, '250 cc');

		// too ambiguous
		rr(/tommy/i, 'tommy the pinball wizard');

		// strip off unnecessary shit
		r(/night mode|megapin/i, '');
		r(/v\d\s*/i, '');
		r(/[^0-9a-z]+/ig, ' ');
		r(/\sss\s/i, '');
		r(/\shr\s/i, '');
		r(/\d+\.\d+\.\d+/, '');
		r(/\d+\.\d+/, '');

		// wtfs
		r(/Amazing Spiderman 2012/i, 'Amazing Spiderman');
		r(/BigDaddyVP9/i, 'Big Daddy');
		r(/HighspeedII/i, 'high speed ii');
		r(/Terminator3/i, 'terminator 3');

		// hacks
		rr(/indiana jones/i, 'indiana jones the pinball adventure'); // until the stern version is out, then we have a problem because the media pack name is wrong

		return name.trim();
	};

	var parseData = function(body, table, searchName, callback) {

		var tidyText = function(m) {
			m = m.replace(/<br>/gi, '\n');
			m = m.replace(/<[^>]+>/gi, '');
			return ent.decode(m.trim());
		};

		var m = body.match(/<a name="(\d+)">([^<]+)/i);
		if (m) {
			table.name = trim(m[2]);
			table.ipdb_no = m[1];
			table.modelno = firstMatch(body, /Model Number:\s*<\/b><\/td><td[^>]*>(\d+)/i);
			table.ipdb_mfg = firstMatch(body, /Manufacturer:\s*<\/b>.*?mfgid=(\d+)/i);
			if (table.ipdb_mfg && manufacturerNames[table.ipdb_mfg]) {
				table.manufacturer = manufacturerNames[table.ipdb_mfg];
			}
			table.year = firstMatch(body, /href="machine\.cgi\?id=\d+">\d+<\/a>\s*<I>[^<]*?(\d{4})/i);

			table.type = firstMatch(body, /Type:\s*<\/b><\/td><td[^>]*>([^<]+)/i, function(m) {
				var mm = m.match(/\((..)\)/);
				return mm ? mm[1] : null;
			});

			table.rating = firstMatch(body, /Average Fun Rating:.*?Click for comments[^\d]*([\d\.]+)/i);
			table.short = firstMatch(body, /Common Abbreviations:\s*<\/b><\/td><td[^>]*>([^<]+)/i, function(m) {
				return m.replace(', ', ',');
			});
			table.units = firstMatch(body, /Production:\s*<\/b><\/td><td[^>]*>([\d,]+)\s*units/i, function(m) {
				return m.replace(/,/g, '');
			});
			table.theme = firstMatch(body, /Theme:\s*<\/b><\/td><td[^>]*>([^<]+)/i, function(m) {
				return m.replace(/\s+-\s+/gi, ',');
			});
			table.designer = firstMatch(body, /Design by:\s*<\/b><\/td><td[^>]*><span[^>]*><a[^>]*>([^<]+)/i, function(m) {
				return ent.decode(m);
			});
			table.artist = firstMatch(body, /Art by:\s*<\/b><\/td><td[^>]*><span[^>]*><a[^>]*>([^<]+)/i, function(m) {
				return ent.decode(m);
			});

			table.features = firstMatch(body, /Notable Features:\s*<\/b><\/td><td[^>]*>(.*?)<\/td>/i, tidyText);
			table.notes = firstMatch(body, /Notes:\s*<\/b><\/td><td[^>]*>(.*?)<\/td>/i, tidyText);
			table.toys = firstMatch(body, /Toys:\s*<\/b><\/td><td[^>]*>(.*?)<\/td>/i, tidyText);
			table.slogans = firstMatch(body, /Marketing Slogans:\s*<\/b><\/td><td[^>]*>([\s\S]*?)<\/td>/i, tidyText);

			table.img_playfield = firstMatch(body, /<span title="[^"]*"><img src="[^"]*" onError="this.src='([^']+)'[^>]+><br>\s*Playfield\s*[\*]?</i, function(url) {
				return url.replace(/tn_/i, '');
			});
			if (!table.img_playfield) {
				table.img_playfield = firstMatch(body, /<span title="[^"]*"><img src="[^"]*" onError="this.src='([^']+)'[^>]+><br>[^<]*Playfield</i, function(url) {
					return url.replace(/tn_/i, '');
				});
			}

			var distance = natural.LevenshteinDistance(Ipdb.prototype.norm(searchName), Ipdb.prototype.norm(m[2]));
			logger.log('info', '[ipdb] Found title "%s" as #%d (distance %d)', table.name, m[1], distance);
			callback(null, table);

		} else {
			logger.log('warn', '[ipdb] Game "%s" not found in HTTP body.', table.name);
			callback(null, table);
		}
	};

	if (!table.name) {
		return callback('First parameter must contain at least "name".');
	}

	if (table.type == 'OG') { // ignore original games
		return callback(null, table);
	}

	var url, m;
	var searchName = fixName(table.name);
	var regex = new RegExp('(' + ipdb.getKnownManufacturers().join('|') + ')', 'i');
	if (m = searchName.match(regex)) {
		table.manufacturer = m[1];
		searchName = searchName.replace(regex, '').trim();
	}

	if (table.ipdb_no && !forceSearch) {
		url = 'http://www.ipdb.org/machine.cgi?id=' + table.ipdb_no;
		logger.log('info', '[ipdb] Refreshing data for ipdb# %s.', table.ipdb_no);
	} else {
		// advanced search: var url = 'http://www.ipdb.org/search.pl?name=' + encodeURIComponent(game.name) + '&searchtype=advanced';
		url = 'http://www.ipdb.org/search.pl?any=' + encodeURIComponent(searchName) + '&searchtype=quick';
		ipdb.emit('searchStarted', { name: searchName });
		logger.log('info', '[ipdb] Searching at ipdb.org for "%s" (%s %d)', searchName, table.manufacturer, table.year);
	}
	logger.log('debug', '[ipdb] Requesting %s', url);
	request(url, function(err, response, body) {

		if (!response) {
			logger.log('error', '[ipdb] Network seems to be down, aborting.');
			return callback('No network.');
		}

		if (err) {
			logger.log('error', '[ipdb] Error requesting %s: %s', url, err);
			return callback('Error requesting data from IPDB.');
		}

		if (response.statusCode != 200) {
			logger.log('error', '[ipdb] Wrong response code, got %s instead of 200. Body: ', response.statusCode, body);
			return callback('Wrong response data from IPDB.');
		}

		if (body.match(/NO records matched/i)) {
			logger.log('info', '[ipdb] No records matched for search query "%s".', searchName);
			return callback(null, table);
		}

		var m;

		// check if multiple matches
		m = body.match(/(\d+) records match/i);
		if (m && m[1] > 1) {

			var numHits = m[1];
			logger.log('info', '[ipdb] Found %d hits for "%s".', numHits, searchName);

			// parse the matches
			var regex = /<tr valign=top><td[^>]+>([\d\?]{4})[^<]*<\/td>\s*<td[^>]+><a class="[^"]*linkid[^"]*"[^>]*href="[^"]*?(\d+)">([^<]+)<\/a><\/td>\s*<td[^>]*><span[^>]*>([^<]+)/ig;

			var matches = [];
			while (m = regex.exec(body)) {
				matches.push({
					name: m[3],
					year: m[1],
					manufacturer: m[4],
					ipdbid: m[2]
					// distance: natural.LevenshteinDistance(Ipdb.prototype.norm(searchName), Ipdb.prototype.norm(m[4])) });
				});
			}
			if (matches.length == 0) {
				logger.log('error', '[ipdb] Failed to match any table entry, check regex.');
				return callback('Error parsing search result from IPDB.');
			}
			if (matches.length < numHits) {
				logger.log('warn', '[ipdb] Warning, %d hits on page, but could only parse %d!', numHits, matches.length);
			}

			// figure out best match
			var match = findBestMatch(matches, table, searchName);
			logger.log('info', '[ipdb] Figured best match is "%s (%s %d)" #%s', match.name, match.manufacturer, match.year, match.ipdbid);

			if (body.match(/Too many matches to display all individual records/i)) {

				url = 'http://www.ipdb.org/machine.cgi?id=' + match.ipdbid;
				logger.log('info', '[ipdb] Table details not on search result page, loading details at %s', url);
				request(url, function(err, response, body) {
					parseData(body, table, searchName, callback);
				});

			} else {

				// strip off non-matches from body
				regex = new RegExp('<table border=0 width="100%"><tr><td><font[^>]*><B><a name="' + match.ipdbid + '">[.\\s\\S]*?<hr width="80', 'gi');
				m = body.match(regex);
				if (!m) {
					callback('Cannot find matched game "' + match.name + '" in body.');
					return;
				}
				parseData(m[0], table, searchName, callback);
			}
		} else {
			parseData(body, table, searchName, callback);
		}

	});
};

/**
 * Fetches the Top 300 page from ipdb.org and updates the database with the
 * ranking.
 *
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of found tables</li></ol>
 */
Ipdb.prototype.syncTop300 = function(callback) {
	var that = this;
	var url = 'http://www.ipdb.org/lists.cgi?anonymously=true&list=top300&submit=No+Thanks+-+Let+me+access+anonymously';
	logger.log('info', '[ipdb] Fetching top 300 list from ipdb.org');
	request(url, function (error, response, body) {
		var regex = /<td align=right nowrap>(\d+)[^<]*<\/td>\s*<td[^>]*>[^<]*<font[^>]*>[^<]*<\/font>\s*<img[^>]*>[^<]*<\/td>\s*<td><font[^>]*>(\d+)<\/font>\s*<B>([^<]+)<\/B>/gi;
		var match;
		var idx = 0;
		var tables = [];
		while (match = regex.exec(body)) {
			var table = {
				ipdb_rank: match[1],
				year : match[2],
				name : trim(match[3])
			};

			if (idx <= 300) {
				table.type = 'SS';
			} else {
				table.type = 'EM';
			}
			tables.push(table);
		}

		var updatedTables = [];
		var updateTables = function(table, next) {

			// try to find a match in db
			schema.Table.findAll({ where: { name: table.name, year: table.year, type: table.type }}).success(function(rows) {

				if (rows.length > 0) {

					// could be multiple hits (vp and fp version, for instance)
					async.eachSeries(rows, function(row, cb) {
						that.emit('top300Matched', { name: row.name, platform: row.platform, rank: table.ipdb_rank });
						logger.log('debug', '[ipdb] Matched %s (%s)', row.name, row.platform);
						row.updateAttributes({ ipdb_rank: table.ipdb_rank }).success(function(table) {
							updatedTables.push(table);
							cb();
						}).error(cb);
					}, next);
				} else {
					next();
				}
			}).error(function(err){
				logger.log('error', '[ipdb] ' + err);
				next(err);
			});
		};

		async.eachSeries(tables, updateTables, function(err) {
			if (!err) {
				callback(null, updatedTables);
			}
			logger.log('info', '[ipdb] Done, returning found games.');
		});
	});
};

/**
 * Returns a list of links to all ROM files for a given table.
 * @param ipdbId IPDB.org ID of the table.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 		<li>{String} Error message on error</li>
 * 		<li>{Array} List of found links. Links are objects with <tt>title</tt>, <tt>filename</tt> and <tt>url</tt>.</li>
 */
Ipdb.prototype.getRomLinks = function(ipdbId, callback) {
	var url = 'http://www.ipdb.org/machine.cgi?id=' + ipdbId;
	logger.log('info', '[ipdb] Fetching details for game ID %s', ipdbId);
	request(url, function (error, response, body) {
		var regex = /ZIP<\/a>&nbsp;<\/td><td[^>]+><a href="([^"]+)"\s*>([^<]+rom[^<]+)/gi;
		var match;
		var links = [];
		while (match = regex.exec(body)) {
			links.push( {
				title: match[2],
				url: match[1],
				filename: match[1].substr(match[1].lastIndexOf('/') + 1).trim()
			})
		}
		callback(null, links);
	});
};

Ipdb.prototype.download = function(transfer, watcher, callback) {

	var that = this;
	var dest = settings.pind.tmp + '/' + transfer.filename;

	that.emit('downloadInitializing', { reference: transfer, fileinfo: transfer.filename ? ' for "' + transfer.filename + '"' : '' });
	that.emit('downloadStarted', { filename: transfer.filename, destpath: dest, reference: transfer });
	logger.log('info', '[ipdb] Downloading %s at %s...', transfer.title, transfer.url);

	var stream = fs.createWriteStream(dest);
	var failed = false;

	stream.on('close', function() {
		watcher.unWatchDownload(dest);

		if (failed) {
			logger.log('info', '[ipdb] Download failed, see %s what went wrong.', dest);
			that.emit('downloadFailed', { message: 'Download failed.' });
			return callback('Download failed.');
		}

		logger.log('info', '[ipdb] Download complete, saved to %s.', dest);
		callback(null, dest);
	});

	stream.on('error', function(err) {
		logger.log('error', '[ipdb] Error downloading %s: %s', transfer.url, err);
	});

	request(transfer.url).on('response', function(response) {

		if (response.statusCode != 200) {
			failed = true;
			logger.log('error', '[ipdb] Download failed with status code %s.', response.statusCode);
			return;
		}
		if (response.headers['content-length']) {
			that.emit('contentLengthReceived', { contentLength: response.headers['content-length'], reference: transfer });
			watcher.watchDownload(dest, response.headers['content-length'], transfer);
		}
	}).pipe(stream);
};

Ipdb.prototype.isSyncing = function() {
	return isSyncing;
};

Ipdb.prototype.getKnownManufacturers = function() {
	return _.uniq(_.values(manufacturerNames));
};

Ipdb.prototype.norm = function(str) {
	return str ? str.toString().replace(/[^a-z0-9\(\)]+/ig, '').toLowerCase() : str;
};

var firstMatch = function(str, regex, postFn) {
	var m = str.match(regex);
	if (m && postFn) {
		return postFn(m[1].replace(/&nbsp;/gi, ' '));
	} else if (m) {
		return m[1].replace(/&nbsp;/gi, ' ');
	} else {
		return null;
	}
};

var trim = function(str) {
	return str.replace(/[^\w\d\s\.\-,:_'"()]/ig, '');
};

var findBestMatch = function(matches, table, searchName) {

	console.log(util.inspect(matches, false, 2, true));

	var normalizeManufacturer = function(manufacturer) {
		if (!manufacturer) {
			return '';
		}
		for (var name in manufacturerGroups) {
			if (manufacturerGroups.hasOwnProperty(name)) {
				var regex = new RegExp('(' + manufacturerGroups[name].join('|') + ')', 'i');
				if (manufacturer.match(regex)) {
					return name.toLowerCase();
				}
			}
		}
		return manufacturer.toLowerCase();
	};

	// on tie, return nearest year
	matches.sort(function(a, b) {

		var tableYear = table.year ? table.year : 0;
		var tableManufacturer = normalizeManufacturer(table.manufacturer);

		// name distance
		var ndA = natural.LevenshteinDistance(Ipdb.prototype.norm(a.name), Ipdb.prototype.norm(searchName));
		var ndB = natural.LevenshteinDistance(Ipdb.prototype.norm(b.name), Ipdb.prototype.norm(searchName));
		// year difference
		var ydA = parseInt(a.year) ? Math.abs(a.year - tableYear) : 0;
		var ydB = parseInt(b.year) ? Math.abs(b.year - tableYear) : 0;
		// manufacturer distance
		var mdA = natural.LevenshteinDistance(normalizeManufacturer(a.manufacturer), tableManufacturer);
		var mdB = natural.LevenshteinDistance(normalizeManufacturer(b.manufacturer), tableManufacturer);

		var byName = ndA == ndB ? 0 : (ndA < ndB ? -1 : 1);
		var byYear = ydA == ydB || !parseInt(a.year) || !parseInt(b.year) ? 0 : (ydA < ydB ? -1 : 1);
		var byManufacturer = mdA == mdB || !tableManufacturer ? 0 : (mdA < mdB ? -1 : 1);

		if (byName) {
			return byName;
		} else {
			if (byYear) {
				return byYear;
			} else {
				return byManufacturer;
			}
		}
	});

	logger.log('info', '[ipdb] Matches are now sorted:');
	var i = 0;
	_.each(matches, function(match) {
		logger.log('info', '[ipdb]   %d. %s (%s %s) [dN=%d, dM=%d]', ++i, match.name, match.manufacturer, match.year,
			natural.LevenshteinDistance(Ipdb.prototype.norm(match.name), Ipdb.prototype.norm(searchName)),
			natural.LevenshteinDistance(normalizeManufacturer(match.manufacturer), normalizeManufacturer(table.manufacturer))
		);
	});

	return matches[0];
};

var manufacturerNames = {
	2: 'Hankin',
	9: 'A.B.T.',
	16: 'All American Games',
	18: 'Allied Leisure',
	20: 'Alvin G.',
	32: 'Astro Games',
	33: 'Atari',
	47: 'Bally',
	48: 'Midway',
	49: 'Wulff',
	53: 'Bell Coin Matics',
	54: 'Bell Games',
	62: 'Briarwood',
	55: 'Bensa',
	71: 'CEA',
	76: 'Capcom',
	81: 'Chicago Coin',
	83: 'Unidesa',
	93: 'Gottlieb',
	94: 'Gottlieb',
	98: 'Data East',
	117: 'Exhibit',
	120: 'Fascination',
	126: 'Game Plan',
	129: 'Geiger',
	130: 'Genco',
	135: 'Guiliano Lodola',
	139: 'Grand Products',
	141: 'Great States',
	145: 'Jac Van Ham',
	153: 'I.D.I.',
	156: 'Inder',
	157: 'Interflip',
	159: 'International Concepts',
	165: 'Jeutel',
	170: 'Juegos Populares',
	206: 'Marvel',
	213: 'Midway',
	214: 'Bally',
	219: 'Mirco',
	222: 'Mr. Game',
	224: 'Gottlieb',
	235: 'Bell Games',
	239: 'P & S',
	248: 'Petaco',
	249: 'Peyper',
	250: 'Pierce Tool',
	252: 'Pinstar',
	255: 'Playmatic',
	257: 'Premier',
	262: 'Petaco',
	267: 'Richard',
	269: 'Rock-ola',
	279: 'Sega',
	280: 'Sega',
	281: 'Williams',
	282: 'Sonic',
	302: 'Stern',
	303: 'Stern',
	311: 'Christian Tabart',
	313: 'Tecnoplay',
	317: 'Midway',
	323: 'United',
	324: 'Universal',
	328: 'Unknown',
	333: 'Viza',
	337: 'Wico',
	349: 'Williams',
	350: 'Williams',
	351: 'Williams',
	352: 'Williams',
	356: 'Zaccaria',
	359: 'RMG',
	367: 'Taito',
	371: 'Recreativos Franco',
	375: 'Spinball',
	419: 'Century Consolidated Industries',
	458: 'Rowamet',
	447: 'Delmar',
	467: 'LTD',
	483: 'ICE',
	495: 'Elbos',
	532: 'United',
	549: 'Professional Pinball of Toronto'
};

var manufacturerGroups = {
	Gottlieb: [ 'Gottlieb', 'Mylstar', 'Premier' ],
	Bally: [ 'Bally', 'Midway' ]
};

module.exports = new Ipdb();