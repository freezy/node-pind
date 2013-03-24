var request = require('request');
var async = require('async');
var natural = require('natural');
var log = require('winston');

var hp;
var Table;

module.exports = function(app) {
	hp = require('./hyperpin')(app);
	Table = app.models.Table;
	return exports;
}

/**
 * Performs a complete update from HyperPin and ipdb.org:
 *  <ol><li>Sync DB with HyperPin's XML "database"</li>
 * 		<li>Fetch additional metadata from ipdb.org for each table</li>
 * 		<li>Fetch top 300 list and update table rankings</li></ol>
 *
 * @param callback Function to execute after completion, invoked with one argumens:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
exports.syncTables = function(callback) {

	// 1. Sync with local database (aka HyperPin)
	hp.syncTables(function(err, tables) {
		if (err) {
			log.error('[ipdb] ' + err);
			return;
		}

		// 2. Fetch data from ipdb.org
		async.eachLimit(tables, 3, exports.enrich, function(err) {

			if (err) {
				log.error('[ipdb] ' + err);
				return;
			}

			// 3. Update db
			async.eachSeries(tables, Table.updateOne, function(err) {
				if (err) {
					log.error('[ipdb] ' + err);
				} else {
					log.info('[ipdb] ' + tables.length + ' games updated.');

					// 4. Update ranking from top 300 list
					exports.syncTop300(function(err, games) {
						if (err) {
							log.error('[ipdb] ' + err);
						} else {
							log.info('[ipdb] Top 300 synced (' + games.length + ' games).');
							callback();
						}
					});
				}
			});
		});
	});
}

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
exports.enrich = function(game, callback) {

	var forceSearch = false;

	if (!game.name) {
		callback('First parameter must contain at least "name".');
		return;
	}

	if (game.type == 'OG') { // ignore original games
		callback(null, game);
		return;
	}

	log.info('[ipdb] Fetching data for ' + game.name);
	var url;
	if (game.ipdb_no && !forceSearch) {
		url = 'http://www.ipdb.org/machine.cgi?id=' + game.ipdb_no;
	} else {
		// advanced search: var url = 'http://www.ipdb.org/search.pl?name=' + encodeURIComponent(game.name) + '&searchtype=advanced';
		url = 'http://www.ipdb.org/search.pl?any=' + encodeURIComponent(game.name.replace(/[^0-9a-z]+/ig, ' ')) + '&searchtype=quick';
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
				game.name = m[2];
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


}

/**
 * Fetches the Top 300 page from ipdb.org and updates the database with the
 * ranking.
 *
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of found tables</li></ol>
 */
exports.syncTop300 = function(callback) {

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
				name : match[3]
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
			Table.all({ where: { name: table.name, year: table.year, type: table.type } }, function(err, rows) {
				if (err) {
					log.error('[ipdb] ' + err);
					next(err);
					return;
				} else if (rows.length > 0) {

					// could be multiple hits (vp and fp version, for instance)
					async.eachSeries(rows, function(row, cb) {
						log.debug('[ipdb] Matched ' + row.name + ' (' + row.platform + ')');
						row.updateAttribute('ipdb_rank', table.ipdb_rank, function(err, table) {
							if (err) {
								cb(err);
							} else {
								updatedTables.push(table);
								cb();
							}
						});
					}, next);
				} else {
					log.debug('[ipdb] No match for  ' + table.name + ' (' + table.year + ')');
					next();
				}
			});
		};

		async.eachSeries(tables, updateTables, function(err) {
			if (!err) {
				callback(null, updatedTables);
			}
			log.error('[ipdb] Done, returning found games.');
		});
	});
}

var firstMatch = function(str, regex) {
	var m = str.match(regex);
	return m ? m[1] : null;
}

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
	})
	console.log('matches are now sorted: %j', bestMatches);

	return bestMatches[0];
}