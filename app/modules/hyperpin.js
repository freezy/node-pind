var fs = require('fs');
var gm = require('gm');
var log = require('winston');
var path = require('path');
var util = require('util');
var exec = require('child_process').exec;
var async = require('async');
var xml2js = require('xml2js');

var schema = require('../model/schema');
var settings = require('../../config/settings-mine');

var platforms = {
	VP: 'Visual Pinball',
	FP: 'Future Pinball'
}

/**
 * Sends a banner version of the table to the given response object.
 * @param res Response object
 * @param p Path of the table, e.g. "/Media/Visual Pinball/Table Images/Some Table.png"
 */
exports.asset_banner = function(res, key) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(res, getPath('Table Images', row), function(gm) {
			return gm
				.rotate('black', -45)
				.crop(800, 150, 400, 1250);
		});
	}).error(function(err) {
		console.log('Error retrieving table for banner ' + key + ': ' + err);
		res.writeHead(500);
	});
}

exports.asset_table = function(res, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(res, getPath('Table Images', row), function(gm) {
			gm.rotate('black', -90);
			if (size != null) {
				gm.resize(size, size);
			}
			return gm;
		});
	}).error(function(err) {
		console.log('Error retrieving table for table image ' + key + ': ' + err);
		res.writeHead(500);
	});
}

exports.asset_logo = function(res, key) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		file(res, getPath('Wheel Images', row));

	}).error(function(err) {
		console.log('Error retrieving table for logo ' + key + ': ' + err);
		res.writeHead(500);
	});
}

exports.asset_backglass = function(res, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(res, getPath('Backglass Images', row), function(gm) {
			if (size != null) {
				gm.resize(size, size);
			}
			return gm;
		});
	}).error(function(err) {
		console.log('Error retrieving table for backglass ' + key + ': ' + err);
		res.writeHead(500);
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
				var tables = [];
				for (var i = 0; i < l; i++) {
					var g = result.menu.game[i];
					var d = g.description[0];
					var table;
					var m = d.match(/([^\(]+)\s+\(([^\)]+)\s+(\d{4})\)/); // match Medieval Madness (Williams 1997)
					if (m) {
						table = {
							name: m[1],
							manufacturer: m[2],
							year: m[3]
						};
					} else {
						table = {
							name: d,
							manufacturer: g.manufacturer[0],
							year: g.year[0]
						};
					}
					if (!g.$ || !g.$.name) {
						log.error('[hyperpin] [' + platform + '] Cannot find "name" attribute for "' + table.name + '".');
						callback('error parsing game "' + table.name + '", XML must contain "name" attribute.');
						return;
					}
					table.hpid = d;
					table.type = g.type[0];
					table.filename = g.$.name;
					table.platform = platform;
					table.enabled = g.enabled === undefined || (g.enabled[0].toLowerCase() == 'true' || g.enabled[0].toLowerCase() == 'yes');

					if (platform == 'VP') {
						table.table_file = fs.existsSync(settings.visualpinball.path + '/Tables/' + table.filename + '.vpt');
					} else if (platform == 'FP') {
						table.table_file = fs.existsSync(settings.futurepinball.path + '/Tables/' + table.filename + '.fpt');
					}

					table.media_table = fs.existsSync(settings.hyperpin.path + '/Media/' + platforms[platform] + '/Table Images/' + table.hpid + '.png');
					table.media_backglass = fs.existsSync(settings.hyperpin.path + '/Media/' + platforms[platform] + '/Backglass Images/' + table.hpid + '.png');
					table.media_wheel = fs.existsSync(settings.hyperpin.path + '/Media/' + platforms[platform] + '/Wheel Images/' + table.hpid + '.png');
					table.media_video = fs.existsSync(settings.hyperpin.path + '/Media/' + platforms[platform] + '/Table Videos/' + table.hpid + '.f4v');

					tables.push(table);
				}
				log.info('[hyperpin] [' + platform + '] Finished parsing ' + tables.length + ' games in ' + (new Date().getTime() - now) + 'ms, updating db now.');
				schema.Table.updateAll(tables, now, callback);
			});
		});
	};

	// launch FP and VP parsing in parallel
	async.eachSeries([ 'FP', 'VP' ], process, function(err) {
		schema.Table.findAll().success(function(rows) {
			callback(null, rows);
		}).error(callback);
	});
};

exports.insertCoin = function(user, slot, callback) {
	console.log('checking amount of credits..');
	if (user.credits > 0) {
		console.log(user.credits + ' > 0, all good, inserting coin.');
		var binPath = fs.realpathSync(__dirname + '../../../bin');
		exec(binPath + '/Keysender.exe', function(error, stdout, stderr) {
			if (error !== null) {
				callback(error);
			} else {
				console.log('coin inserted, updating user credits.');
				user.credits--;
				user.save(['credits']).success(function(u) {
					console.log('user credits updated to ' + u.credits + ', calling callback.');
					callback(null, {
						message : 'Coin inserted successfully!',
						credits : u.credits
					});
				}).error(callback);
			}
		});
	} else {
		callback('No more credits available.');
	}
};

var asset = function(res, path, process) {
	if (path && fs.existsSync(path)) {
		var now = new Date().getTime();
		process(gm(path)).stream(function (err, stream, stderr) {
			if (err) next(err);
			res.writeHead(200, { 'Content-Type': 'image/png' });
			stream.pipe(res);
			console.log("image processed in %d ms.", new Date().getTime() - now);
		});
	} else {
		res.writeHead(404);
		res.end('Sorry, ' + path + ' not found.');
	}
};

var file = function(res, path) {
	if (fs.existsSync(path)) {
		res.writeHead(200, { 'Content-Type': 'image/png' });
		var stream = fs.createReadStream(path);
		stream.pipe(res);
	} else {
		res.writeHead(404);
		res.end('Sorry, ' + filePath + ' not found.');
	}
}

function getPath(what, table) {
	if (table == null) {
		return null;
	}
	return settings.hyperpin.path + '/Media/' + (table.platform == 'FP' ? 'Future' : 'Visual') + ' Pinball/' + what + '/' + table.hpid + '.png';
}
