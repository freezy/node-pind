'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var exec = require('child_process').exec;
var async = require('async');
var events = require('events');
var xml2js = require('xml2js');
var logger = require('winston');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var an = require('./announce');
var vp = require('./visualpinball');
var vpf = require('./vpforums');

var isSyncing = false;
var isSearchingMedia = false;

var platforms = {
	VP: 'Visual Pinball',
	FP: 'Future Pinball'
};

function HyperPin() {
	events.EventEmitter.call(this);
	this.initAnnounce();
}
util.inherits(HyperPin, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 */
HyperPin.prototype.initAnnounce = function() {

	var ns = 'hp';

	// syncTablesWithData()
	an.data(this, 'processingStarted', { id: 'hpsync' }, ns);
	an.notice(this, 'syncCompleted', 'Done syncing, starting analysis...');
	an.notice(this, 'analysisCompleted', 'Finished analyzing tables.', 5000);
	an.data(this, 'processingCompleted', { id: 'hpsync' }, ns);

	// syncTables()
	an.notice(this, 'xmlParsed', 'Read {{num}} tables from {{platform}}.xml, updating local database...');
	an.notice(this, 'tablesUpdated', 'Updated {{num}} tables in database.');

	// findMissingMedia()
	an.data(this, 'mediaSearchStarted', { id: 'dlmedia' }, ns, 'processingStarted');
	an.data(this, 'mediaSearchCompleted', { id: 'dlmedia' }, ns, 'processingCompleted');
	an.notice(this, 'mediaSearchSucceeded', 'Successfully added {{count}} media packs to download queue.', 5000);
	an.notice(this, 'searchStarted', 'Searching {{what}} for "{{name}}"', 60000);
	an.notice(this, 'searchCompleted', '{{msg}}');
	an.forward(this, 'tableUpdated', ns);
};

HyperPin.prototype.syncTablesWithData = function(callback) {
	var that = this;

	if (isSyncing) {
		return callback('Syncing process already running. Wait until complete.');
	}
	that.emit('processingStarted');
	isSyncing = true;

	this.syncTables(function(err) {
		that.emit('syncCompleted');
		if (err) {
			logger.log('error', '[hyperpin] ERROR: ' + err);
			return callback(err);
		}

		vp.updateTableData(function(err) {
			if (err) {
				throw new Error(err);
			}
			that.emit('analysisCompleted', 5000);
			isSyncing = false;
			that.emit('processingCompleted');
			callback();
		});
	});
};

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
		logger.log('info', '[hyperpin] [' + platform + '] Reading games from ' + dbfile);

		fs.readFile(dbfile, function(err, data) {

			if (err) {
				logger.log('error', '[hyperpin] [' + platform + '] ' + err);
					return callback('Error reading file: ' + err);
			}

			var parser = new xml2js.Parser();
			parser.parseString(data, function (err, result) {

				if (err) {
					logger.log('error', '[hyperpin] [' + platform + '] ' + err);
                    return callback('error parsing file: ' + err);
				}
				if (!result.menu) {
					logger.log('error', '[hyperpin] [' + platform + '] Root element "menu" not found, aborting.');
                    return callback('weird xml file, root element "menu" not found.');
				}
				if (!result.menu['game']) {
					logger.log('warn', '[hyperpin] [' + platform + '] XML database is empty.');
					return callback(null, []);
				}

				var l = result.menu['game'].length;
				var tables = [];
				for (var i = 0; i < l; i++) {
					var g = result.menu['game'][i];
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
						logger.log('error', '[hyperpin] [' + platform + '] Cannot find "name" attribute for "' + table.name + '".');
						callback('error parsing game "' + table.name + '", XML must contain "name" attribute.');
						return;
					}
					table.hpid = d;
					table.hpenabled = true;
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
				logger.log('info', '[hyperpin] [' + platform + '] Finished parsing ' + tables.length + ' games in ' + (new Date().getTime() - now) + 'ms, updating db now.');
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
        if (err) {
            throw new Error(err);
        }
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

	if (isSearchingMedia) {
		return callback('Media search process already running. Wait until complete.');
	}
	that.emit('mediaSearchStarted');
	isSearchingMedia = true;

	/**
	 * Downloads and extracts media file.
	 * @param row Table row
	 * @param what For logging
	 * @param findFct Function that searches and downloads media pack and runs callback with path of downloaded file.
	 * @param next Callback
	 */
	var process = function(row, what, findFct, next) {
		that.emit('searchStarted', { what: what, name: row.name });
		findFct.call(vpf, row, function(err, msg) {
			if (err) {
				logger.log('error', '[hyperpin] Error searching for media: %s', err);
				return next(err);
			}
			that.emit('searchCompleted', { msg: msg });
			logger.log('info', '[hyperpin] Successfully queued: %s', msg);
			next();
		});
	};

	schema.Table.all({ where: 'NOT `media_table` OR NOT `media_backglass` OR NOT `media_wheel`' }).success(function(rows) {
		async.eachSeries(rows, function(row, next) {
			process(row, 'media pack', vpf.findMediaPack, next);
		}, function(err) {
			if (err) {
				logger.log('error', '[hyperpin] Error finding table vids: %s', err);
				isSearchingMedia = false;
				that.emit('mediaSearchCompleted');
				return callback(err);
			}

			var count = rows.length;

			// TODO: move this up into process and make process public. process also takes a flag for ignoreTableVids.
			// now, do the same for table video.
			if (!settings.pind.ignoreTableVids) {
				// do the same for the tables
				schema.Table.all({ where: 'NOT `media_video`' }).success(function(rows) {
					async.eachSeries(rows, function(row, next) {
						process(row, 'table video', vpf.findTableVideo, next);
					}, function(err) {
						if (err) {
							logger.log('error', '[hyperpin] Error finding table vids: %s', err);
							isSearchingMedia = false;
							that.emit('mediaSearchCompleted');
							return callback(err);
						}
						count += rows.length;
						// long session, logout.
						vpf.logout(function() {
							isSearchingMedia = false;
							that.emit('mediaSearchCompleted');
							that.emit('mediaSearchSucceeded', { count: count });
							callback();
						});
					});
				});
			} else {
				// long session, logout.
				vpf.logout(function() {
					isSearchingMedia = false;
					that.emit('mediaSearchCompleted');
					that.emit('mediaSearchSucceeded', { count: count });
					callback();
				});
			}
		});
	});
};

/**
 * Triggers a coin insert.
 * @param user
 * @param slot
 * @param callback
 */
HyperPin.prototype.insertCoin = function(user, slot, callback) {
	logger.log('info', '[hyperpin] Checking amount of credits');
	if (user.credits > 0) {
		logger.log('info', '[hyperpin] %d > 0, all good, inserting coin.', user.credits);
		//noinspection JSUnresolvedVariable
        var binPath = fs.realpathSync(__dirname + '../../../bin');
		exec(binPath + '/Keysender.exe', function(err) {
			if (err !== null) {
				callback(err);
			} else {
				logger.log('info', '[hyperpin] Coin inserted, updating user credits.');
				schema.User.find(user.id).success(function(row) {
					user.credits--;
					row.credits--;
					row.save(['credits']).success(function(u) {
						logger.log('info', '[hyperpin] User credits updated to %d, calling callback.', u.credits);
						callback(null, {
							message : 'Coin inserted successfully!',
							credits : u.credits
						});
					});
				});
			}
		});
	} else {
		callback('No more credits available.');
	}
};

HyperPin.prototype.isSyncing = function() {
	return isSyncing;
};

HyperPin.prototype.isSearchingMedia = function() {
	return isSearchingMedia;
};

module.exports = new HyperPin();