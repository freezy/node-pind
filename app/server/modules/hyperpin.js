var fs = require('fs');
var path = require('path');
var xml2js = require('xml2js');
var config =  require('konphyg')(__dirname + '../../../config');
var settings = config('settings');


exports.asset = function(res, p) {

	var filePath = settings.hyperpin.path + '/Media/Future Pinball/' + p;
	path.exists(filePath, function(exists) {
		if (exists) {
			fs.readFile(filePath, function(err, content) {
				if (err) {
					res.send(err, 500);
					return;
				}
				res.writeHead(200, { 'Content-Type': 'image/png' });
				res.end(content);
			});
		} else {
			res.writeHead(404);
			res.end('Sorry, ' + filePath + ' not found.');
		}
	});
}

/**
 * Reads XML from Hyperpin config and returns list of found games.
 * @param callback First param is error string, second array of games.
 */
exports.readTables = function(callback) {

	fs.readFile(settings.hyperpin.path + '/Databases/Future Pinball/Future Pinball.xml', function(err, data) {
		if (err) {
			callback('error reading file: ' + err);
			return;
		}
		var parser = new xml2js.Parser();
		parser.parseString(data, function (err, result) {
			var now = new Date().getTime();
			if (err) {
				callback('error parsing file: ' + err);
				return;
			}
			if (!result.menu) {
				callback('weird xml file, root element "menu" not found.');
				return;
			}
			if (!result.menu.game) {
				callback(null, []);
				return;
			}

			//console.log("result = %j", result);

			var l = result.menu.game.length;
			var games = [];
			for (var i = 0; i < l; i++) {
				var g = result.menu.game[i];
				var d = g.description[0];
				var m = d.match(/([^\(]+)\s+\(([^\)]+)\s+(\d{4})\)/); // match Medieval Madness (Williams 1997)
				var game;
				if (m) {
					game = {
						name: m[0],
						manufacturer: m[1],
						year: m[2]
					};
				} else {
					game = {
						name: d,
						manufacturer: g.manufacturer[0],
						year: g.year[0]
					};
				}
				if (!g.$ || !g.$.name) {
					callback('error parsing game "' + game.name + '", XML must contain "name" attribute.');
					return;
				}
				game.type = g.type[0];
				game.filename = g.$.name;
				games.push(game);
			}
			console.log("parsed in %d ms.", new Date().getTime() - now);

			callback(null, games);
		});
	});
};
