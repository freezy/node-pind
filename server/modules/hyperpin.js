'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var exec = require('child_process').exec;
var xmlw = require('xml-writer');
var async = require('async');
var events = require('events');
var xml2js = require('xml2js');
var logger = require('winston');
var natural = require('natural');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var an = require('./announce');
var au = require('./autoupdate');
var vp = require('./visualpinball');
var vpf = require('./vpforums');

var isReading = false;
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

	// readTablesWithData()
	an.data(this, 'processingStarted', { id: 'hpread' }, ns, 'admin');
	an.notice(this, 'readCompleted', 'Done reading tables, starting analysis...', 'admin');
	an.notice(this, 'analysisCompleted', 'Finished analyzing tables.', 'admin', 5000);
	an.data(this, 'processingCompleted', { id: 'hpread' }, ns, 'admin');

	// readTables()
	an.notice(this, 'xmlParsed', 'Read {{num}} tables from {{platform}}.xml, updating local database...', 'admin');
	an.notice(this, 'tablesUpdated', 'Updated {{num}} tables in database.', 'admin');

	// findMissingMedia()
	an.data(this, 'mediaSearchStarted', { id: 'dlmedia' }, ns, 'admin', 'processingStarted');
	an.data(this, 'mediaSearchCompleted', { id: 'dlmedia' }, ns, 'admin', 'processingCompleted');
	an.notice(this, 'mediaSearchSucceeded', 'Successfully added {{count}} media packs to download queue.', 'admin', 5000);
	an.notice(this, 'searchStarted', 'Searching {{what}} for "{{name}}"', 'admin', 60000);
	an.notice(this, 'searchCompleted', '{{msg}}', 'admin');
	an.forward(this, 'tableUpdated', ns);

	// toggles
	an.forward(this, 'dataUpdated');
	an.forward(this, 'statusUpdated');
};

HyperPin.prototype.readTablesWithData = function(callback) {
	var that = this;

	if (isReading) {
		return callback('Reading process already running. Wait until complete.');
	}
	that.emit('processingStarted');
	isReading = true;

	this.readTables(function(err) {
		that.emit('readCompleted');
		if (err) {
			logger.log('error', '[hyperpin] ERROR: ' + err);
			return callback(err);
		}

		vp.updateTableData(function(err) {
			isReading = false;
			that.emit('analysisCompleted', 5000);
			that.emit('processingCompleted');
			callback(err);
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
HyperPin.prototype.readTables = function(callback) {
	var that = this;
	var now = new Date().getTime();
	var process = function(platform, callback) {

		var dbfile = settings.hyperpin.path + '/Databases/' + platforms[platform] + '/' + platforms[platform] + '.xml';

		if (!fs.existsSync(dbfile)) {
			logger.log('warn', '[hyperpin] [' + platform + '] Skipping synchronization, "%s" not found.', dbfile);
			return callback();
		}

		logger.log('info', '[hyperpin] [' + platform + '] Reading games from ' + dbfile);
		fs.readFile(dbfile, function(err, data) {

			if (err) {
				logger.log('error', '[hyperpin] [' + platform + '] ' + err);
				return callback('Error reading file: ' + err);
			}

			var parseAndAdd = function(data, active, callback) {

				var parser = new xml2js.Parser();
				parser.parseString(data, function(err, result) {
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
						return callback();
					}

					var tables = [];
					async.eachSeries(result.menu['game'], function(g, next) {

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
								year: g.year[0] ? g.year[0] : null
							};
						}
						if (!g.$ || !g.$.name) {
							logger.log('error', '[hyperpin] [' + platform + '] Cannot find "name" attribute for "' + table.name + '".');
							return callback('error parsing game "' + table.name + '", XML must contain "name" attribute.');
						}
						if (g.$.name && !g.$.name.match(/Table Name Goes Here/i)) {
							table.filename = g.$.name;
						}
						table.hpid = d;
						table.hpenabled = active;
						table.type = g.type[0];

						table.platform = platform;
						table.enabled = g.enabled === undefined || (g.enabled[0].toLowerCase() == 'true' || g.enabled[0].toLowerCase() == 'yes');

						if (g.$.ipdb) {
							table.ipdb_no = g.$.ipdb;
						}

						if (platform == 'VP') {
							table.table_file = fs.existsSync(settings.visualpinball.path + '/Tables/' + table.filename + '.vpt');
						} else if (platform == 'FP') {
							table.table_file = fs.existsSync(settings.futurepinball.path + '/Tables/' + table.filename + '.fpt');
						}

						table.media_table = fs.existsSync(settings.hyperpin.path + '/Media/' + platforms[platform] + '/Table Images/' + table.hpid + '.png');
						table.media_backglass = fs.existsSync(settings.hyperpin.path + '/Media/' + platforms[platform] + '/Backglass Images/' + table.hpid + '.png');
						table.media_wheel = fs.existsSync(settings.hyperpin.path + '/Media/' + platforms[platform] + '/Wheel Images/' + table.hpid + '.png');
						table.media_video = fs.existsSync(settings.hyperpin.path + '/Media/' + platforms[platform] + '/Table Videos/' + table.hpid + '.f4v');

						if (g.$.vpf) {
							schema.VpfFile.find({ where: { fileId: g.$.vpf }}).success(function(row) {
								if (row) {
									table.ref_src = row.id;
									table.edition = row.edition; // overwrite, since more accurate.
								}
								tables.push(table);
								next();
							})
						} else {
							tables.push(table);
							next();
						}

					}, function() {

						logger.log('info', '[hyperpin] [' + platform + '] Finished parsing ' + tables.length + ' games in ' + (new Date().getTime() - now) + 'ms, updating db now.');
						that.emit('xmlParsed', { num: tables.length, platform: platforms[platform] });

						schema.Table.updateAll(tables, now, function(err, tables) {
							if (err) {
								logger.log('error', '[hyperpin] [%s] %s', platform, err);
							}
							that.emit('tablesUpdated', { num: tables.length });
							callback(err);
						});
					});

				});
			};

			// also parse commented games and add them as non-active.
			var regex = new RegExp(/<!--([\s\S]*?)-->/g);
			var m, commentedGames = '', comments = '';
			while (m = regex.exec(data.toString('utf8'))) {
				comments += m[1];
			}
			regex = new RegExp(/(name="[^"]+">[\s\S]*?)<\/game/g);
			while (m = regex.exec(comments)) {
				commentedGames += '<game ' + m[1] + '</game>';
			}

			// process non-commented and commented xml.
			async.series([
				function(callback) {
					parseAndAdd(data, true, callback);
				},
				function(callback) {
					if (commentedGames.trim()) {
						parseAndAdd('<menu>' + commentedGames + '</menu>', false, callback);
					} else {
						callback();
					}
				}
			], callback);
		});
	};

	// disable all tables first
	schema.sequelize.query('UPDATE tables SET hpenabled = 0').success(function() {

		// launch FP and VP parsing in parallel
		async.eachSeries([ 'FP', 'VP' ], process, function(err) {
			if (err) {
				return callback(err);
			}
			schema.Table.findAll().success(function(rows) {
				callback(null, rows);
			});
		});
	});
};

HyperPin.prototype.writeTables = function(callback) {

	var platform = 'VP';
	var query = 'SELECT t.*, v.fileId FROM tables t LEFT JOIN vpf_files v ON t.ref_src = v.id WHERE platform = "VP" ORDER by t.name ASC';
	schema.sequelize.query(query).success(function(rows) {

		var i, row, game;
		var writer = new xmlw(true);
		writer.startDocument();
		writer.startElement('menu');

		for (i = 0; i < rows.length; i++) {
			row = rows[i];
			if (!row.hpid) {
				continue;
			}
			if (!row.hpenabled && settings.hyperpin.onItemDisabled == 'remove') {
				continue;
			}

			writer.startElement(row.hpenabled ? 'game' : '_game');
			writer.writeAttribute('name', row.filename);
			if (row.ipdb_no) {
				writer.writeAttribute('ipdb', row.ipdb_no);
			}
			if (row.fileId) {
				writer.writeAttribute('vpf', row.fileId);
			}
			writer.writeElement('description', row.hpid);
			if (row.manufacturer) {
				writer.writeElement('manufacturer', row.manufacturer);
			}
			if (row.year) {
				writer.writeElement('year', String(row.year));
			}
			if (row.type) {
				writer.writeElement('type', row.type);
			}
			writer.writeElement('enabled', row.enabled ? 'yes' : 'no');
			writer.endElement();
		}
		var xml = writer.toString();

		// comment out disabled games
		if (settings.hyperpin.onItemDisabled != 'remove') {
			xml = xml.replace(/<_game/g, '<!--game');
			xml = xml.replace(/<\/_game>/g, '</game-->');
		}
		xml = xml.replace('<?xml version="1.0"?>', '').replace(/    /g, '\t').replace(/\n/g, '\r\n').trim();
		var version = au.getVersion();
		var header = '<!--\n' +
			'	This database file was automatically created by Pind ' + version.version + ' (' + version.sha.substr(0, 7) + ').\r\n\r\n' +
			'	In case something went wrong, the original file was renamed to\r\n' +
			'		"' + platforms[platform] + ' - Pind Backup.xml".\r\n\r\n' +
			'	If you feel that an issue should be fixed, feel free to submit a bug report at\r\n' +
			'		https://github.com/freezy/node-pind/issues\r\n\r\n' +
			'	For now, if you have a completely different naming schema than HyperPin\'s "Name (vendor year)"\r\n' +
			'	you can update or add the "ipdb" attribute at the "game" elements below. If set, Pind will rely\r\n' +
			'	on this first, before searching the name on IPDB.org.\r\n\r\n' +
			'	For original games, you can add the "vpf" attribute, which contains VPF\'s file ID, that\'s the\r\n' +
			'	"showfile" number you see in the address bar of a download page at VPForums.org.\r\n\r\n' +
			'	Keeping those IDs correct makes sure Pind knows which downloads correspond to which of your tables\r\n' +
			'	This makes sure the right entries get updated or added.\r\n' +
			'-->\r\n\r\n';

		var write = function(filename, data) {
			logger.log('info', 'Writing database to %s', filename);
			fs.writeFile(filename, data, callback);
		};

		var filename = settings.hyperpin.path + '/Databases/' + platforms[platform] + '/' + platforms[platform] + '.xml';
		var bakname = settings.hyperpin.path + '/Databases/' + platforms[platform] + '/' + platforms[platform] + ' - Pind Backup.xml';
		if (!fs.existsSync(bakname) && fs.existsSync(filename)) {
			logger.log('info', '[hyperpin] Backuping current database %s before writing new data', platforms[platform] + '.xml');
			fs.createReadStream(filename).pipe(fs.createWriteStream(bakname)).on('close', function() {
				logger.log('info', '[hyperpin] Done, saved to %s', bakname);
				write(filename, header + xml);
			});

		} else {
			write(filename, header + xml);
		}
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
		findFct.call(vpf, row, null, function(err, msg) {
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

HyperPin.prototype.matchSources = function(callback) {

	vpf.getTables(null, function(err, sources) {
		if (err) {
			return callback(err);
		}
		schema.Table.all({ where: { platform: 'VP' }}).success(function(tables) {
			var i, j, table, source, d, minD, match, s, t;
			for (i = 0; i < tables.length; i++) {
				table = tables[i];
				minD = -1;
				t = table.filename.replace(/[^a-z0-9]*/gi, '').toLowerCase();
				console.log(table.filename);
				for (j = 0; j < sources.length; j++) {
					source = sources[j];
					s = source.title.replace(/[^a-z0-9]*/gi, '').toLowerCase();
					d = natural.LevenshteinDistance(t, s);
					if (minD < 0 || d < minD) {
						match = source;
						minD = d;
					}
				}
				console.log('%s (%d - %s%)\n', match.title, minD, Math.round((1 - minD / ((t.length + s.length) / 2)) * 100));
			}
			callback();
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
	var that = this;
	logger.log('info', '[hyperpin] Checking amount of credits');
	if (user.credits > 0) {
		logger.log('info', '[hyperpin] %d > 0, all good, inserting coin.', user.credits);
		//noinspection JSUnresolvedVariable
        var binPath = fs.realpathSync(__dirname + '../../../bin');
		exec(binPath + '/Keysender.exe', function(err) {
			if (err) {
				return callback(err);
			}
			logger.log('info', '[hyperpin] Coin inserted, updating user credits.');
			schema.User.find(user.id).success(function(row) {
				user.credits--;
				row.credits--;
				row.save(['credits']).success(function(u) {
					logger.log('info', '[hyperpin] User credits updated to %d, calling callback.', u.credits);
					that.emit('statusUpdated', { _user: user.user });
					callback(null, {
						message : 'Coin inserted successfully!',
						credits : u.credits
					});
				});
			});
		});
	} else {
		callback('No more credits available.');
	}
};

/**
 * Enables or disables a game in HyperPin's database.
 * @param key Table key (from database)
 * @param value true or false
 * @param callback Callback with only error arg as first arg.
 */
HyperPin.prototype.setEnabled = function(key, value, callback) {
	var that = this;
	schema.Table.find({ where: { key: key }}).success(function(row) {
		if (!row) {
			return callback('Cannot find row with key "' + key + '".');
		}
		logger.log('info', '[hyperpin] %s table with key "%s" in database.', value ? 'Enabling' : 'Disabling', key);
		row.updateAttributes({ hpenabled: value ? true : false}).success(function(row) {
			that.emit('dataUpdated', { resource: 'table', row: row });
			that.writeTables(callback);
		});
	});
};

HyperPin.prototype.isReading = function() {
	return isReading;
};

HyperPin.prototype.isSearchingMedia = function() {
	return isSearchingMedia;
};

module.exports = new HyperPin();