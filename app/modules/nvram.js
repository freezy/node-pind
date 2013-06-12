var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var async = require('async');
var events = require('events');
var logger = require('winston');
var Buffer = require('buffer').Buffer;
var Duration = require('duration');

var wpc = require('./rom/wpc')();
var schema = require('../model/schema');
var settings = require('../../config/settings-mine');

function NvRam(app) {
	if ((this instanceof NvRam) === false) {
		return new NvRam(app);
	}
	events.EventEmitter.call(this);
//	this.initAnnounce(app);

}
util.inherits(NvRam, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 * @param app Express application
 */
NvRam.prototype.initAnnounce = function(app) {
//	var an = require('./announce')(app, this);
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
	wpc.readAudits(ram, rom, callback);
};



NvRam.prototype.diff = function() {

	var file1 = settings.vpinmame.path + '/nvram/mm_109c - 02-00.nv';
	var file2 = settings.vpinmame.path + '/nvram/mm_109c - 02-02.nv';
	var file3 = settings.vpinmame.path + '/nvram/mm_109c - v1.nv';

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

	logger.log('debug', 'Comparing...');
	for (var i = 0; i < len; i++) {
		var b1 = wpcReadHex(ram1, i, 1);
		var b2 = wpcReadHex(ram2, i, 1);
		var b3 = wpcReadHex(ram3, i, 1);

		if (Math.abs(b1 - b2) == 2 && Math.abs(b1 - b3) == 5) {
			logger.log('debug', 'Found diff at %s', i.toString(16));
		}
	}
	logger.log('debug', 'Done!');
};

module.exports = NvRam;



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
