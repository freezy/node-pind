var fs = require('fs');
var gm = require('gm');
var log = require('winston');
var path = require('path');
var util = require('util');
var exec = require('child_process').exec;
var async = require('async');
var events = require('events');
var xml2js = require('xml2js');

var schema = require('../model/schema');
var settings = require('../../config/settings-mine');
var vp, vpf, extr;

var disableCache = false;
var isSyncing = false;
var platforms = {
	VP: 'Visual Pinball',
	FP: 'Future Pinball'
}

function HyperPin(app) {
	if ((this instanceof HyperPin) === false) {
		return new HyperPin(app);
	}

	events.EventEmitter.call(this);
	vp = require('./visualpinball')(app);
	vpf = require('./vpforums')(app);
	extr = require('./extract')(app);

/*	var an = require('./announce')(app, this);

	an.data('processingStarted', { id: '#hpsync' });
	an.notice('syncCompleted', 'Done syncing, starting analysis...');
	an.notice('analysisCompleted', 'Finished analyzing tables.', 5000);
	an.data('processingCompleted', { id: '#hpsync' });*/
}
util.inherits(HyperPin, events.EventEmitter);


/**
 * Sends a banner version of the table to the given response object.
 * @param res Response object
 * @param p Path of the table, e.g. "/Media/Visual Pinball/Table Images/Some Table.png"
 */
HyperPin.prototype.asset_banner = function(context, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Table Images', row), function(gm, callback) {
			gm.rotate('black', -45);
			gm.crop(800, 150, 400, 1250);
			if (size != null) {
				gm.resize(size, size);
			}
			callback(gm);
		});
	}).error(function(err) {
		console.log('Error retrieving table for banner ' + key + ': ' + err);
		context.res.writeHead(500);
	});
}

HyperPin.prototype.asset_table = function(context, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Table Images', row), function(gm, callback) {
			gm.rotate('black', -90);
			if (size != null) {
				gm.resize(size, size);
			}
			callback(gm);
		});
	}).error(function(err) {
		console.log('Error retrieving table for table image ' + key + ': ' + err);
		context.res.writeHead(500);
	});
}

HyperPin.prototype.asset_logo = function(context, key) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		file(context, getPath('Wheel Images', row));

	}).error(function(err) {
		console.log('Error retrieving table for logo ' + key + ': ' + err);
		context.res.writeHead(500);
	});
}

HyperPin.prototype.asset_square = function(context, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Table Images', row), function(gm, callback) {
			gm.rotate('black', -120);
			gm.crop(590, 590, 800, 1100);
			if (size != null) {
				gm.resize(size, size);
			}
			callback(gm);
		});
	}).error(function(err) {
		console.log('Error retrieving table for square ' + key + ': ' + err);
		context.res.writeHead(500);
	});
}


HyperPin.prototype.asset_widescreen = function(context, key, size) {

	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Backglass Images', row), function(gm, callback) {

			gm.size(function(err, dim) {
				var ar = 1.777777777777778;
				var h = dim.width / ar;

				gm.crop(dim.width, h, 0, 0);
				if (size != null) {
					gm.resize(size, size);
				}
				callback(gm);
			})
		});
	}).error(function(err) {
		console.log('Error retrieving table for square ' + key + ': ' + err);
		context.res.writeHead(500);
	});

/*	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Table Images', row), function(gm, callback) {
			gm.rotate('black', -120);
			gm.crop(800, 450, 700, 1180);
			if (size != null) {
				gm.resize(size, size);
			}
 			callback(gm);
		});
	}).error(function(err) {
		console.log('Error retrieving table for square ' + key + ': ' + err);
		context.res.writeHead(500);
	});*/
}

HyperPin.prototype.asset_backglass = function(context, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Backglass Images', row), function(gm, callback) {
			if (size != null) {
				gm.resize(size, size);
			}
			callback(gm);
		});
	}).error(function(err) {
		console.log('Error retrieving table for backglass ' + key + ': ' + err);
		context.res.writeHead(500);
	});
}

HyperPin.prototype.syncTablesWithData = function(callback) {
	var that = this;

	if (isSyncing) {
		return callback('Syncing process already running. Wait until complete.');
	}
	console.log('********** EMITTING "processingStarted"');
	that.emit('processingStarted');
	isSyncing = true;

	this.syncTables(function(err) {
		if (err) {
			console.log("ERROR: " + err);
			throw new Error(err);
		} else {
			that.emit('syncCompleted');

			vp.updateTableData(function(err, tables) {
				if (err) {
					throw new Error(err);
				}
				that.emit('analysisCompleted', 5000);
				isSyncing = false;
				that.emit('processingCompleted');
				callback();
			});
		}
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
HyperPin.prototype.syncTables = function(callback) {
	var that = this;
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
				that.emit('xmlParsed', { num: tables.length, platform: platforms[platform] });

				schema.Table.updateAll(tables, now, function(err, tables) {
					that.emit('tablesUpdated', { num: tables.length });
					callback(err, tables);
				});
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

/**
 * Loops through all tables that are any media missing, searches for it on vpforums.org,
 * downloads it and extracts to the correct location.
 *
 * @param callback
 */
HyperPin.prototype.findMissingMedia = function(callback) {

	var that = this;

	/**
	 * Downloads and extracts media file.
	 * @param row Table row
	 * @param what For logging
	 * @param findFct Function that searches and downloads media pack and runs callback with path of downloaded file.
	 * @param next Callback
	 */
	var process = function(row, what, findFct, next) {
		that.emit('searchStarted', { what: what, name: row.name });
		findFct(row, function(err, filename) {
			if (err) {
				return next(err);
			}
			that.emit('searchCompleted');
			extr.extract(filename, row.hpid, function(err, files) {
				if (err) {
					return next(err);
				}
				console.log('Successfully extracted ' + files.length + ' media files.');
				if (files.length > 0) {
					that.emit('tableUpdated', { key: row.key });
				}
				fs.unlinkSync(filename);
				next();
			});
		});
	};

	schema.Table.all({ where: 'NOT `media_table` OR NOT `media_backglass` OR NOT `media_wheel`' }).success(function(rows) {
		async.eachSeries(rows, function(row, next) {
			process(row, 'media pack', vpf.findMediaPack, next);
		}, function(err) {
			if (err) {
				return callback(err);
			}

			// TODO: move this up into process and make process public. process also takes a flag for ignoreTableVids.
			// now, do the same for table video.
			if (!settings.pind.ignoreTableVids) {
				// do the same for the tables
				schema.Table.all({ where: 'NOT `media_video`' }).success(function(rows) {
					async.eachSeries(rows, function(row, next) {
						process(row, 'table video', vpf.findTableVideo, next);
					}, function(err) {
						if (err) {
							return callback(err);
						}
						// long session, logout.
						vpf.logout(function() {
							this.syncTables(callback);
						});
					});
				});
			} else {
				// long session, logout.
				vpf.logout(function() {
					this.syncTables(callback);
				});
			}
		});
	}).error(callback);
};

/**
 * Triggers a coin insert.
 * @param user
 * @param slot
 * @param callback
 */
HyperPin.prototype.insertCoin = function(user, slot, callback) {
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

HyperPin.prototype.isSyncing = function() {
	return isSyncing;
}

var asset = function(context, path, process) {
	if (path && fs.existsSync(path)) {

		// caching
		var modified = new Date(fs.fstatSync(fs.openSync(path, 'r')).mtime);
		var ifmodifiedsince = new Date(context.req.headers['if-modified-since']);
		if (modified.getTime() >= ifmodifiedsince.getTime() && !disableCache) {
			context.res.writeHead(304);
			context.res.end();
			return;
		}

		// cache, process.
		var now = new Date().getTime();
		process(gm(path), function(gm) {
			gm.stream(function (err, stream, stderr) {
				if (err) next(err);
				context.res.writeHead(200, {
					'Content-Type': 'image/png',
					'Cache-Control': 'private',
					'Last-Modified': modified
				});
				stream.pipe(context.res);
				console.log("image processed in %d ms.", new Date().getTime() - now);
			});
		});
	} else {
		context.res.writeHead(404);
		context.res.end('Sorry, ' + path + ' not found.');
	}
};

var file = function(context, path) {
	// caching
	var modified = new Date(fs.fstatSync(fs.openSync(path, 'r')).mtime);
	var ifmodifiedsince = new Date(context.req.headers['if-modified-since']);
	if (modified.getTime() >= ifmodifiedsince.getTime()) {
		context.res.writeHead(304);
		context.res.end();
		return;
	}	
	if (fs.existsSync(path)) {
		context.res.writeHead(200, { 'Content-Type': 'image/png' });
		var stream = fs.createReadStream(path);
		stream.pipe(context.res);
	} else {
		context.res.writeHead(404);
		context.res.end('Sorry, ' + filePath + ' not found.');
	}
}

function getPath(what, table) {
	if (table == null) {
		return null;
	}
	return settings.hyperpin.path + '/Media/' + (table.platform == 'FP' ? 'Future' : 'Visual') + ' Pinball/' + what + '/' + table.hpid + '.png';
}

module.exports = HyperPin;