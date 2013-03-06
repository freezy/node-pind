var fs = require('fs');
var gm = require('gm');
var log = require('winston');
var path = require('path');
var async = require('async');
var xml2js = require('xml2js');
var config =  require('konphyg')(__dirname + '../../../config');
var settings = config('settings');

var tm = require('./table-manager');

var platforms = {
	VP: 'Visual Pinball',
	FP: 'Future Pinball'
}

/**
 * Sends a banner version of the table to the given response object.
 * @param res Response object
 * @param p Path of the table, e.g. "/Media/Visual Pinball/Table Images/Some Table.png"
 */
exports.asset_banner = function(res, p) {
	asset(res, p, function(gm) {
		return gm
			.rotate('black', -45)
			.crop(800, 150, 400, 1250);
	});
}

exports.asset_table = function(res, p, size) {
	asset(res, p, function(gm) {
		gm.rotate('black', -90);
		if (size != null) {
			gm.resize(size, size);
		}
		return gm;
	});
}

/**
 * Reads XML from Hyperpin config and updates database. Tables that were
 * removed from Hyperpin are marked as disabled.
 *
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} Updated table object</li></ol>
 */
exports.syncTables = function(callback) {

	var now = new Date().getTime();
	var process = function(platform, callback) {

		var dbfile = settings.hyperpin.path + '/Databases/' + platforms[platform] + '/' + platforms[platform] + '.xml';
		log.info('[hyperpin] [' + platform + '] Reading games from ' + dbfile);

		fs.readFile(dbfile, function(err, data) {

			if (err) {
				log.error('[hyperpin] [' + platform + '] ' + err);
				callback('error reading file: ' + err);
				return;
			}
			var parser = new xml2js.Parser();
			parser.parseString(data, function (err, result) {

				if (err) {
					log.error('[hyperpin] [' + platform + '] ' + err);
					callback('error parsing file: ' + err);
					return;
				}
				if (!result.menu) {
					log.error('[hyperpin] [' + platform + '] Root element "menu" not found, aborting.');
					callback('weird xml file, root element "menu" not found.');
					return;
				}
				if (!result.menu.game) {
					log.warn('[hyperpin] [' + platform + '] XML database is empty.');
					callback(null, []);
					return;
				}

				var l = result.menu.game.length;
				var games = [];
				for (var i = 0; i < l; i++) {
					var g = result.menu.game[i];
					var d = g.description[0];
					var game;
					var m = d.match(/([^\(]+)\s+\(([^\)]+)\s+(\d{4})\)/); // match Medieval Madness (Williams 1997)
					if (m) {
						game = {
							name: m[1],
							manufacturer: m[2],
							year: m[3]
						};
					} else {
						game = {
							name: d,
							manufacturer: g.manufacturer[0],
							year: g.year[0]
						};
					}
					if (!g.$ || !g.$.name) {
						log.error('[hyperpin] [' + platform + '] Cannot find "name" attribute for "' + game.name + '".');
						callback('error parsing game "' + game.name + '", XML must contain "name" attribute.');
						return;
					}
					game.hpid = d;
					game.type = g.type[0];
					game.filename = g.$.name;
					game.platform = platform;
					game.enabled = g.enabled === undefined || (g.enabled[0].toLowerCase() == 'true' || g.enabled[0].toLowerCase() == 'yes');
					games.push(game);
				}
				log.info('[hyperpin] [' + platform + '] Finished parsing ' + games.length + ' games in ' + (new Date().getTime() - now) + 'ms, updating db now.');
				tm.updateTables(games, now, callback);
			});
		});
	};

	// launch FP and VP parsing in parallel
	async.each([ 'FP', 'VP' ], process, function(err) {
		tm.findAll(callback);
	});
};

var asset = function(res, p, process) {

	var filePath = settings.hyperpin.path + p;
	fs.exists(filePath, function(exists) {
		if (exists) {
			var now = new Date().getTime();
			process(gm(filePath)).stream(function (err, stdout, stderr) {
				if (err) next(err);
				res.writeHead(200, { 'Content-Type': 'image/png' });
				stdout.pipe(res);
				console.log("image processed in %d ms.", new Date().getTime() - now);
			});
		} else {
			res.writeHead(404);
			res.end('Sorry, ' + filePath + ' not found.');
		}
	});
};