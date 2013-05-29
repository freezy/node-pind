var log = require('winston');
var util = require('util');
var async = require('async');
var events = require('events');
var natural = require('natural');
var request = require('request');

var schema = require('../model/schema');

var hp, ipdb;
var isSyncing = false;

function Ipdb(app) {
	if ((this instanceof Ipdb) === false) {
		return new Ipdb(app);
	}
	events.EventEmitter.call(this);
	this.initAnnounce(app);

	ipdb = this;
	hp = require('./hyperpin')(app);
}
util.inherits(Ipdb, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 * @param app Express application
 */
Ipdb.prototype.initAnnounce = function(app) {
	var an = require('./announce')(app, this);

	// syncIPDB()
	an.data('processingStarted', { id: '#ipdbsync' });
	an.data('processingCompleted', { id: '#ipdbsync' });
	an.notice('processingCompleted', 'Finished matching IPDB.', 5000);

	// enrichAll()
	an.notice('fetchingCompleted', 'Updating database with {{num}} data sets', 30000);
	an.notice('updateCompleted', '{{num}} games updated, fetching top 300 games', 30000);
	an.notice('top300Completed', 'Top 300 synced ({{num}} games).', 30000);

	// enrich()
	an.notice('searchStarted', 'Searching for "{{name}}"', 30000);

	// syncTop300()
	an.notice('top300Matched', 'Matched {{name}} ({{platform}}) at rank {{rank}}.', 30000);
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
	hp.syncTables(function(err, tables) {
		if (err) {
			log.error('[ipdb] ' + err);
			return;
		}

		// fetch data from ipdb.org
		that.enrichAll(tables, callback);
	});
};

Ipdb.prototype.enrichAll = function(tables, callback) {
	var that = this;
	async.eachLimit(tables, 3, this.enrich, function(err) {

		if (err) {
			log.error('[ipdb] ' + err);
			callback(err);
			return;
		}
		that.emit('fetchingCompleted', { num: tables.length });

		// update db
		async.eachSeries(tables, function(table, cb) {

			table.save().success(function(r) {
				cb(null, r);
			}).error(cb);

		}, function(err) {

			if (err) {
				log.error('[ipdb] ' + err);
				callback(err);
			} else {
				that.emit('updateCompleted', { num: tables.length });
				log.info('[ipdb] ' + tables.length + ' games updated.');

				// update ranking from top 300 list
				that.syncTop300(function(err, games) {
					if (err) {
						log.error('[ipdb] ' + err);
						callback(err);
					} else {
						that.emit('top300Completed', { num: games.length });
						log.info('[ipdb] Top 300 synced (' + games.length + ' games).');
						callback();
					}
				});
			}
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
 * 	    <li>short - Abbreviation</li></ul>
 *
 * Note that games of type OG (original) are skipped directly, since ipdb.org
 * only contains real world machines.
 *
 * @param game Game from database. Must contain at least name.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} Updated table object</li></ol>
 */
Ipdb.prototype.enrich = function(game, callback) {

	var forceSearch = false;

	/**
	 * ipdb.org is quite picky about names and spelling errors etc will
	 * result in empty search results.
	 *
	 * This function fixes common spelling mistakes and name aberrations.
	 * @param n Original name from HyperPin
	 */
	var fixName = function(n) {

		var name = n;
		var r = function(needle, haystack) {
			name = name.replace(needle, haystack);
		};

		// common spelling errors
		r(/judgement day/i, 'judgment day');
		r(/ad+am+s family/i, 'addams family');

		// variations
		r(/high speed 2/i, 'high speed ii');
		r(/attack and revenge from mars/i, 'revenge from mars');

		// strip off unnecessary shit
		r(/night mode/i, '');
		r(/v\d$/i, '');
		r(/[^0-9a-z]+/ig, ' ');

		return name;
	};

	if (!game.name) {
		return callback('First parameter must contain at least "name".');
	}

	if (game.type == 'OG') { // ignore original games
		return callback(null, game);
	}

	ipdb.emit('searchStarted', { name: game.name });
	log.info('[ipdb] Fetching data for ' + game.name);
	var url;
	if (game.ipdb_no && !forceSearch) {
		url = 'http://www.ipdb.org/machine.cgi?id=' + game.ipdb_no;
	} else {
		// advanced search: var url = 'http://www.ipdb.org/search.pl?name=' + encodeURIComponent(game.name) + '&searchtype=advanced';
		url = 'http://www.ipdb.org/search.pl?any=' + encodeURIComponent(fixName(game.name)) + '&searchtype=quick';
	}
	log.debug('[ipdb] Requesting ' + url);
	request(url, function (error, response, body) {
		if (!error && response.statusCode == 200) {

			var m;

			// check if multiple matches
			m = body.match(/(\d+) records match/i);
			if (m && m[1] > 1) {
				log.debug('[ipdb] Found ' + m[1] + ' hits for "' + game.name + '".');

				// parse the matches
				var regex = /<tr valign=top><td nowrap class="(normal|divider)" align=left>(\d{4})[^<]*<\/td>\s*<td[^>]*><a class="linkid"\s+href="#(\d+)">([^<]+)/ig;
				var matches = [];
				while (m = regex.exec(body)) {
					matches.push({ name: m[4], year: m[2], ipdbid: m[3], distance: natural.LevenshteinDistance(game.name.toLowerCase(), m[4].toLowerCase()) });
				}

				// figure out best match
				var match = findBestMatch(matches, game);
				log.info('[ipdb] Figured best match is "' + match.name + '" (' + match.ipdbid + ')');

				// strip off non-matches from body
				regex =  new RegExp('<table border=0 width="100%"><tr><td><font[^>]*><B><a name="' + match.ipdbid + '">[.\\s\\S]*?<hr width="80', 'gi');
				m = body.match(regex);
				if (!m) {
					callback('Cannot find matched game "' + match.name + '" in body.');
					return;
				}
				body = m[0];
			}

			m = body.match(/<a name="(\d+)">([^<]+)/i);
			if (m) {
				game.name = trim(m[2]);
				game.ipdb_no = m[1];
				game.modelno = firstMatch(body, /Model Number:\s*<\/b><\/td><td[^>]*>(\d+)/i);
				game.ipdb_mfg = firstMatch(body, /Manufacturer:\s*<\/b>.*?mfgid=(\d+)/i);
				game.rating = firstMatch(body, /<b>Average Fun Rating:.*?Click for comments[^\d]*([\d\.]+)/i);
				game.short = firstMatch(body, /Common Abbreviations:\s*<\/b><\/td><td[^>]*>([^<]+)/i);

				var distance = natural.LevenshteinDistance(game.name, m[2]);
				log.debug('[ipdb] Found title "' + game.name + '" as #' + m[1] + ' (distance ' + distance + ')');
				callback(null, game);

			} else {
				log.warn('[ipdb] Game "' + game.name + '" not found in HTTP body.');
				callback(null, game);
			}
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
	log.info('[ipdb] Fetching top 300 list from ipdb.org');
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
						log.debug('[ipdb] Matched ' + row.name + ' (' + row.platform + ')');
						row.updateAttributes({ ipdb_rank: table.ipdb_rank }).success(function(table) {
							updatedTables.push(table);
							cb();
						}).error(cb);
					}, next);
				} else {
					next();
				}
			}).error(function(err){
				log.error('[ipdb] ' + err);
				next(err);
			});
		};

		async.eachSeries(tables, updateTables, function(err) {
			if (!err) {
				callback(null, updatedTables);
			}
			log.error('[ipdb] Done, returning found games.');
		});
	});
};

/**
 * Returns a list of links to all ROM files for a given table.
 * @param ipdbId IPDB.org ID of the table.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of found links. Links are objects with <tt>name</tt> and <tt>url</tt>.</li></ol>
 */
Ipdb.prototype.getRomLinks = function(ipdbId, callback) {
	var url = 'http://www.ipdb.org/machine.cgi?id=' + ipdbId;
	log.info('[ipdb] Fetching details for game ID ' + ipdbId);
	request(url, function (error, response, body) {
		var regex = /ZIP<\/a>&nbsp;<\/td><td[^>]+><a href="([^"]+)"\s*>([^<]+rom[^<]+)/gi;
		var match;
		var urls = [];
		while (match = regex.exec(body)) {
			urls.push( {
				title: match[2],
				url: match[1],
				filename: match[1].substr(match[1].lastIndexOf('/') + 1).trim()
			})
		}
		callback(null, urls);
	});
};

Ipdb.prototype.isSyncing = function() {
	return isSyncing;
};

var firstMatch = function(str, regex) {
	var m = str.match(regex);
	return m ? m[1] : null;
};

var trim = function(str) {
	return str.replace(/[^\w\d\s\.\-,:_'"()]/ig, '');
};

var findBestMatch = function(matches, game) {

	// sort by distance
	matches.sort(function(a, b) {
		if (a.distance < b.distance) {
			return -1;
		}
		if (a.distance > b.distance) {
			return 1;
		}
		return 0;
	});

	// check for ties
	var best = matches[0].distance;
	var bestMatches = [];
	for (var i = 0; i < matches.length; i++) {
		if (matches[i].distance == best) {
			bestMatches.push(matches[i]);
		} else {
			break;
		}
	}
	if (bestMatches.length == 1) {
		return bestMatches[0];
	}

	// on tie, return nearest year
	bestMatches.sort(function(a, b) {
		if (Math.abs(a.year - game.year) < Math.abs(b.year - game.year)) {
			return -1;
		}
		if (Math.abs(a.year - game.year) > Math.abs(b.year - game.year)) {
			return 1;
		}
		return 0;
	});
	console.log('matches are now sorted: %j', bestMatches);

	return bestMatches[0];
};

module.exports = Ipdb;