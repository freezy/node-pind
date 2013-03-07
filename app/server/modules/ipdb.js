var request = require('request');
var async = require('async');
var natural = require('natural');
var log = require('winston');
var tm = require('./table-manager');
var hp = require('./hyperpin');

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
	hp.syncTables(function(err, games) {
		if (err) {
			log.error('[ipdb] ' + err);
			return;
		}

		// 2. Fetch data from ipdb.org
		async.eachLimit(games, 3, exports.enrich, function(err) {

			if (err) {
				log.error('[ipdb] ' + err);
				return;
			}

			// 3. Update db
			async.eachSeries(games, tm.updateTable, function(err) {
				if (err) {
					log.error('[ipdb] ' + err);
				} else {
					log.info('[ipdb] ' + games.length + ' games updated.');

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
 * 	    <li>ipdbno - ipdb.org number</li>
 * 	    <li>ipdbmfg - ipdb.org manufacturer ID</li>
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

	if (!game.name) {
		callback('First parameter must contain at least "name".');
		return;
	}

	if (game.type == 'OG') { // ignore original games
		callback(null, game);
		return;
	}

	log.info('[ipdb] Fetching data for ' + game.name);
//	var url = 'http://www.ipdb.org/search.pl?name=' + encodeURIComponent(game.name) + '&searchtype=advanced';
	var url;
	if (game.ipdbno) {
		url = 'http://www.ipdb.org/machine.cgi?id=' + game.ipdbno;
	} else {
		url = 'http://www.ipdb.org/search.pl?any=' + encodeURIComponent(game.name) + '&searchtype=quick';
//		if (game.year) {
//			url += '&yr=' + game.year;
//		}
	}
	log.debug('[ipdb] Requesting ' + url);
	request(url, function (error, response, body) {
		if (!error && response.statusCode == 200) {

			var m = body.match(/<a name="(\d+)">([^<]+)/i);
			if (m) {
				game.name = m[2];
				game.ipdbno = m[1];
				game.modelno = match(body, /Model Number:\s*<\/b><\/td><td[^>]*>(\d+)/i);
				game.ipdbmfg = match(body, /Manufacturer:\s*<\/b>.*?mfgid=(\d+)/i);
				game.rating = match(body, /<b>Average Fun Rating:.*?Click for comments[^\d]*([\d\.]+)/i);
				game.short = match(body, /Common Abbreviations:\s*<\/b><\/td><td[^>]*>([^<]+)/i);

				var distance = natural.LevenshteinDistance(game.name, m[2]);
				log.debug('[ipdb] Found title "' + game.name + '" as #' + m[1] + ' (distance ' + distance + ')');
				callback(null, game);

			} else {
				log.warn('[ipdb] Nothing found in HTTP body.');
				callback(null, game);
			}
		}
	});

	var match = function(str, regex) {
		var m = str.match(regex);
		return m ? m[1] : null;
	}
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
		while (match = regex.exec(body)) {
			var game = {
				ipdbrank: match[1],
				year : match[2],
				name : match[3]
			};

			if (idx <= 300) {
				game.type = 'SS';
			} else {
				game.type = 'EM';
			}
			var foundGames = 0;
			var updatedGames = [];

			// try to find a match in db
			tm.find(game, function(err, rows, game) {
				if (err) {
					log.error('[ipdb] ' + err);
					callback(err);
					return;
				} else if (rows.length > 0) {
					for (var i = 0; i < rows.length; i++) {
						var row = rows[i];
						log.debug('[ipdb] Matched ' + game.name + ' (' + row.platform + ')');
						foundGames++;
						var updatedGame = {
							id: row.id,
							ipdbrank: game.ipdbrank
						};
						tm.updateTable(updatedGame, function(err, game) {
							updatedGames.push(game);
							if (updatedGames.length == foundGames) {
								log.error('[ipdb] Done, returning found games.');
								callback(null, updatedGames);
							}
						});
					}
				}
			});
			idx++;
		}
	});
}