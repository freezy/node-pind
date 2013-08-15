'use strict';

var fs = require('fs');
var util = require('util');
var async = require('async');
var events = require('events');
var logger = require('winston');
var request = require('request');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var an = require('./announce');
var vpf = require('./vpforums');
var ipdb = require('./ipdb');

var isFetchingRoms = false;

function VPinMAME() {
	events.EventEmitter.call(this);
	this.initAnnounce();
}
util.inherits(VPinMAME, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 */
VPinMAME.prototype.initAnnounce = function() {

	var ns = 'vpm';

	// fetchHighscores()
	an.data(this, 'processingStarted', { id: 'dlrom' }, ns);
	an.data(this, 'processingCompleted', { id: 'dlrom' }, ns);
	an.notice(this, 'processingNoRomsFound', 'All tables already seem to have a ROM available.', 5000);
	an.notice(this, 'processingCompleted', 'All done, {{num}} ROMs queued for download.', 5000);
	an.notice(this, 'processingFailed', 'Error finding ROMs: {{err}}', 3600000);

	// fetchMissingRom() -> download()
	an.notice(this, 'ipdbDownloadStarted', 'IPDB: Downloading "{{filename}}"', 60000);
	an.notice(this, 'ipdbSearchStarted', 'IPDB: Searching ROMs for "{{name}}"', 60000);
};

VPinMAME.prototype.fetchMissingRom = function(table, callback) {

	var downloadedRoms = [];
	var that = this;

	/**
	 * Loops through a list of download links, checks if the file is already
	 * locally available and otherwise queues it using the given download
	 * function.
	 *
	 * @param links List of download links
	 * @param engine How to download. "vpf" or "ipdb" for now.
	 * @param callback Callback function
	 */
	var checkAndQueue = function(links, engine, callback) {
		async.eachSeries(links, function(link, next) {
			if (!fs.existsSync(settings.vpinmame.path + '/roms/' + link.filename)) {
				queue(link, settings.vpinmame.path + '/roms', engine, link.id, function(err, filepath) {
					downloadedRoms.push(filepath);
					next();
				});
			} else {
				logger.log('info', '[vpm] ROM %s already available, skipping.', link.filename);
				next();
			}
		}, callback);
	};

	/**
	 * Updates the row with rom_file status.
	 * @param row
	 * @param next
	 * @todo run this after download completes, right now it's no use after queue.
	 */
	var checkSuccess = function(row, next) {
		if (row.rom) {
			logger.log('info', '[vpm] Updating table row with new ROM status...');
			row.updateAttributes({
				rom_file: fs.existsSync(settings.vpinmame.path + '/roms/' + row.rom + '.zip')
			}).success(function() {
				next(null, downloadedRoms);
			});

		} else {
			next(null, downloadedRoms);
		}
	};

	/**
	 * Queues a file to the transfer table.
	 * @param link
	 * @param folder
	 * @param engine
	 * @param reference
	 * @param next
	 */
	var queue = function(link, folder, engine, reference, next) {

		// this will queue a new transfer.
		that.emit('queueTransfer', {
			title: link.title,
			url: link.url,
			filename: link.filename,
			type: 'rom',
			engine: engine,
			reference: reference
		});
		next();
	};

	/**
	 * Downloads all ROMs from vpforums.org (that don't exist already).
	 * @param table Tables row from database
	 * @param next Callback
	 */
	var downloadVPF = function(table, next) {
		vpf.getRomLinks(table, function(err, links) {
			if (err) {
				logger.log('error', '[vpm] ERROR: ' + err);
				return next(err);
			}
			checkAndQueue(links, 'vpf', function(err) {
				if (err) {
					return next(err);
				}
				checkSuccess(table, next);
			});
		});
	};

	/**
	 * Downloads all ROMs from ipdb.org (that don't exist already), followed
	 * by vpforums.org.
	 * @param table Tables row from database
	 * @param next Callback
	 */
	var downloadIPDB = function(table, next) {
		that.emit('ipdbSearchStarted', { name: table.name });
		ipdb.getRomLinks(table.ipdb_no, function(err, links) {
			logger.log('info', '[vpm] IPDB ROMS: %s', util.inspect(links));
			if (err) {
				logger.log('error', '[vpm] ERROR: ' + err);
				return next(err);
			}
			checkAndQueue(links, 'ipdb', function(err) {
				if (err) {
					return next(err);
				}
				downloadVPF(table, next);
			});
		});
	};

	if (table.ipdb_no) {
		downloadIPDB(table, callback);
	} else {
		logger.log('warn', '[vpm] WARNING: ROM file found in table but no IPDB ID. Maybe try matching IPDB.org first?');
		downloadVPF(table, callback);
	}

};

/**
 * Checks ipdb.org and vpforums.org for ROMs and downloads them, preferably from
 * ipdb.org.
 *
 * @param callback
 */
VPinMAME.prototype.fetchMissingRoms = function(callback) {

	if (isFetchingRoms) {
		return callback('Fetching process already running. Wait until complete.');
	}
	var that = this;
	that.emit('processingStarted');
	isFetchingRoms = true;
	var downloadedRoms = [];

	logger.log('info', '[vpm] Fetching tables with no ROM file...');
	schema.Table.findAll({ where: 'NOT `rom_file` AND rom IS NOT NULL' }).success(function(rows) {
		if (rows.length == 0) {
			that.emit('processingCompleted', { num: 0 });
			that.emit('processingNoRomsFound');
			isFetchingRoms = false;
			return callback(null, []);
		}
		async.eachSeries(rows, function(row, next) {
			that.fetchMissingRom(row, function(err, dlRoms) {
				if (err) {
					return next(err);
				}
				downloadedRoms = downloadedRoms.concat(dlRoms);
				next();
			});
		}, function(err) {
			that.emit('processingCompleted', { num: downloadedRoms.length });
			if (err) {
				that.emit('processingfailed', { err: err });
				callback(err);
			} else {
				callback(null, downloadedRoms);
			}
			isFetchingRoms = false;
		});
	});
};

VPinMAME.prototype.isFetchingRoms = function() {
	return isFetchingRoms;
};

module.exports = new VPinMAME();