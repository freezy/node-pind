var request = require('request');
var natural = require('natural');
var xregexp = require('xregexp').XRegExp;
var tm = require('./table-manager');

exports.enrich = function(game, callback) {

	if (!game.name) {
		callback('Cannot search without name!');
		return;
	}

	if (game.type == 'OG') { // ignore original games
		callback();
		return;
	}

	console.log("enriching " + game.name);
	var url = 'http://www.ipdb.org/search.pl?name=' + encodeURIComponent(game.name) + '&yr=' + game.year + '&searchtype=advanced';
	console.log("requesting " + url);
	request(url, function (error, response, body) {
		if (!error && response.statusCode == 200) {

			var m = body.match(/<a name="(\d+)">([^<]+)/i);
			if (m) {
				game.name = m[2];
				game.ipdbno = m[1];
				game.modelno = body.match(/Model Number:\s*<\/b><\/td><td[^>]*>(\d+)/i)[1];
				game.ipdbmfg = body.match(/Manufacturer:\s*<\/b>.*?mfgid=(\d+)/i)[1];
				game.rating = body.match(/<b>Average Fun Rating:.*?Click for comments[^\d]*([\d\.]+)/i)[1];
				game.short = body.match(/Common Abbreviations:\s*<\/b><\/td><td[^>]*>([^<]+)/i)[1];

				console.log("%d found title %s (distance %s)", m[1], game.name, natural.LevenshteinDistance(game.name, m[2]));

				callback();
			} else {
				console.log('nothing found in http body.');
				callback('nothing found in http body.');
			}
		}
	});
}

exports.syncTop300 = function(callback) {
	var url = 'http://www.ipdb.org/lists.cgi?anonymously=true&list=top300&submit=No+Thanks+-+Let+me+access+anonymously';
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
			tm.find(game, function(err, row, game) {
				if (err) {
					console.log("ERROR: " + err);
					callback(err);
					return;
				} else {
					if (row !== undefined) {
						foundGames++;
						var updatedGame = {
							id: row.id,
							ipdbrank: game.ipdbrank
						};
						tm.updateTable(updatedGame, function(err, game) {
							updatedGames.push(game);
							if (updatedGames.length == foundGames) {
								callback(null, updatedGames);
							}
						});
					}
				}
			});
			idx++;
		}
		console.log("looped through regex matches.");
	});
}