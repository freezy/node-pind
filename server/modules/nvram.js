'use strict';

var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var async = require('async');
var events = require('events');
var logger = require('winston');
var Buffer = require('buffer').Buffer;
var Duration = require('duration');

var an = require('./announce');
var wpc = require('./rom/wpc');
var stern = require('./rom/stern');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var isFetching;

function NvRam() {
	events.EventEmitter.call(this);
	this.initAnnounce();
}
util.inherits(NvRam, events.EventEmitter);

/**
 * Sets up event listener for realtime updates.
 */
NvRam.prototype.initAnnounce = function() {

	var ns = 'nvram';

	// fetchHighscores()
	an.data(this, 'processingStarted', { id: 'fetchaudits' }, ns, 'admin');
	an.data(this, 'processingCompleted', { id: 'fetchaudits' }, ns, 'admin');
};


/**
 * Updates data from .nv RAM files.
 *
 * Loops through available tables
 *
 * @param callback Function to execute after completion, invoked with one argument:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
NvRam.prototype.readTables = function(callback) {

	if (isFetching) {
		return callback('Fetching process already running. Wait until complete.');
	}
	var that = this;
	isFetching = true;
	that.emit('processingStarted');

	// fetch all VP table and store them into a dictionary
	schema.Table.all({ where: '`platform` = "VP" AND `rom` IS NOT NULL', order: 'name DESC' }).then(function(rows) {
		var roms = [];
		var tables = {};

		// only retrieve roms that actually have an .nv file.
		for (var i = 0; i < rows.length; i++) {
			if (fs.existsSync(settings.vpinmame.path + '/nvram/' + rows[i].rom + '.nv')) {
				roms.push(rows[i].rom);
				tables[rows[i].rom] = rows[i];
			}
		}
		roms = _.uniq(roms);
		logger.log('info', '[nvram] Found %d VP tables with ROM and a nvram.', roms.length);

		async.eachSeries(roms, function(rom, next){

			NvRam.prototype.readAudits(rom, function(err, audit) {
				if (err) {
					logger.log('error', '[nvram] [%s] Error reading audit: %s', rom, err);
					return next(err);
				}
				if (audit == null) {
					logger.log('warn', '[nvram] [%s] Could not read nvram data.', rom);
					return next();
				}
//				logger.log('info', '[nvram] [%s] Got audit:', rom, audit);
				schema.Rom.find({ where: { name: rom }}).then(function(row) {
					var attrs = {
						name: rom,
						extraBalls: audit.extraBalls,
						gamesStarted: audit.gamesStarted,
						gamesPlayed: audit.gamesPlayed,
						playTime: audit.playTime,
						runningTime: audit.runningTime,
						ballsPlayed: audit.ballsPlayed,
						scoreHistogram: JSON.stringify(audit.scoreHistogram),
						playtimeHistogram: JSON.stringify(audit.playtimeHistogram)
					};
					if (row) {
						row.updateAttributes(attrs, [
							'name', 'extraBalls', 'gamesStarted', 'gamesPlayed', 'playTime', 'runningTime',
							'ballsPlayed', 'scoreHistogram', 'playtimeHistogram'
						]).then(function(row) {
							logger.log('info', '[nvram] Successfully updated rom "%s".', row.name);
							next();
						});
					} else {
						schema.Rom.create(attrs).then(function(row) {
							logger.log('info', '[nvram] Successfully created rom "%s".', row.name);
							next();
						});
					}
				});
			})
		}, function(err) {

			isFetching = false;
			that.emit('processingCompleted');

			if (err) {
				logger.log('error', 'Error fetching audits: %s', err);
				return callback(err);
			}

			logger.log('info', '[nvram] Reading done.');
			callback();
		});
	});
};


NvRam.prototype.readAll = function(startWith, callback) {

	if (!startWith) {
		startWith = '0';
	}
	var that = this;
	var skip = [ '' ];
	var files = fs.readdirSync(settings.vpinmame.path + '/nvram');
	var nvrams = [];
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		if (file[0] < startWith) {
			continue;
		}
		var nvram = file.substr(0, file.length - 3);
		if (file.substr(file.length - 3, file.length) == '.nv' && !_.contains(skip, nvram)) {
			nvrams.push(nvram);
		}
	}
	var m1 = 0;
	var m2 = 0;
	async.eachSeries(nvrams, function(nvram, next) {
		that.readAudits(nvram, function(err, audit) {
			if (!err) {
				if (audit.match == 1) {
					if (!audit.isValid) {
						logger.log('debug', 'INVALID but full match: %s', nvram);
					} else {
						logger.log('debug', 'Full match: %s', nvram);
					}
					m1++;
				} else if (audit.match > 0) {
					if (!audit.isValid) {
						logger.log('debug', 'INVALID but Partial match: %s (%s%)', nvram, Math.round(audit.match * 1000) / 10);
					} else {
						logger.log('debug', 'Partial match: %s (%s%)', nvram, Math.round(audit.match * 1000) / 10);
					}
					m2++;
				} else {
					if (audit.isValid) {
						logger.log('debug', 'VALID but no match: %s', nvram);
					}
				}
			}
			next(err);
		});
	}, function(err) {
		logger.log('info', '====================================================');
		logger.log('info', 'Number of ROMs: %d', nvrams.length);
		logger.log('info', 'Full match: %d (%s%)', m1, Math.round(m1 / nvrams.length * 100));
		logger.log('info', 'Partial match: %d (%s%)', m2, Math.round(m2 / nvrams.length * 100));
		logger.log('info', 'No match: %d (%s%)', nvrams.length - m1 - m2, Math.round((nvrams.length - m1 - m2) / nvrams.length * 100));
		callback(err);
	});
};


NvRam.prototype.readAudits = function(rom, callback) {

	// init and checks
	var file = settings.vpinmame.path + '/nvram/' + rom + '.nv';
	if (!fs.existsSync(file)) {
		return callback('Cannot find .nv file at "' + file + '".');
	}

	// read ram and check size
	var ram = fs.readFileSync(file);
	if (ram.length < 0x1883) {
		return callback(null, { match: 0 });
	}

	if (stern.isValid(ram)) {
		stern.readAudits(ram, rom, callback);
	} else if (wpc.isValid(ram)) {
		wpc.readAudits(ram, rom, callback);
		//callback();
	} else {
		logger.log('warn', '[nvram] No valid parser found for ROM "%s".', rom);
		callback();
	}
};



NvRam.prototype.diff = function() {

	var file1 = settings.vpinmame.path + '/nvram/ripleys.nv';
	var file2 = settings.vpinmame.path + '/nvram/elvis.nv';
	var file3 = settings.vpinmame.path + '/nvram/lotr.nv';

	var ram1 = fs.readFileSync(file1);
	var ram2 = fs.readFileSync(file2);
	var ram3 = fs.readFileSync(file3);

	if (ram1.length != ram2.length) {
		return logger.log('error', 'Files must be the same size (%s vs %s).', ram1.length, ram2.length);
	}

	if (ram2.length != ram3.length) {
		return logger.log('error', 'Files must be the same size (%s vs %s).', ram2.length, ram3.length);
	}

	var len = ram1.length;
	var read = function(buf, offset) {
//		return buf.readUInt8(offset);
//		return buf.readUInt16LE(offset);
		return buf.readUInt16BE(offset);
//		return buf.readUInt32LE(offset);
//		return buf.readUInt32BE(offset);
//		return readHexAsDec(buf, offset, 4);
	}

	logger.log('info', 'Comparing...');
	for (var i = 0; i < len - 3; i++) {
		var b1 = read(ram1, i);
		var b2 = read(ram2, i);
		var b3 = read(ram3, i);

		if (Math.abs(b1 - b2) == 3 && Math.abs(b1 - b3) == 1) {
			logger.log('info', 'Found diff at 0x%s', i.toString(16));
		}
	}
	logger.log('info', 'Done!');
};

function readHexAsDec(buf, pos, len) {
	var num = '';
	for (var i = 0; i < len; i++) {
		var n = buf.readUInt8(pos + i).toString(16);
		num += n.length == 1 ? '0' + n : n;
	}
	return num;
}

/**
 * Reads a number from a CAPCOM RAM.
 * @param buf RAM
 * @param pos Start position
 * @param len Number of characters to read. Since we're reading 2 bytes, per char, this equals bytes / 2.
 * @returns {number}
 */
function capcomReadHex(buf, pos, len) {
	var num = 0;
	for (var i = 0; i < len; i++) {
		num += buf.readUInt16BE(pos + (i * 2)) * Math.pow(256, len - i - 1);
	}
	return num;
}

module.exports = new NvRam();