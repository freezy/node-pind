var fs = require('fs');
var util = require('util');
var async = require('async');
var events = require('events');
var logger = require('winston');
var request = require('request');
var schema = require('../model/schema');
var settings = require('../../config/settings-mine');

var ipdb, vpf, _app;

var isFetchingRoms = false;


function VPinMAME(app) {
	if ((this instanceof VPinMAME) === false) {
		return new VPinMAME(app);
	}
	events.EventEmitter.call(this);
	this.initAnnounce(app);

	ipdb = require('./ipdb')(app);
	vpf = require('./vpforums')(app);

	// transfer needs to be initialized later, otherwise we'll get
	// path.js:163
	// resolvedTail = normalizeArray(resolvedTail.split(/[\\\/]+/).filter(f),
	// 	^
	//	RangeError: Maximum call stack size exceeded
	// no idea WTF that's supposed to mean.
	_app = app;
}
util.inherits(VPinMAME, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 * @param app Express application
 */
VPinMAME.prototype.initAnnounce = function(app) {
	var an = require('./announce')(app, this);

	// fetchHighscores()
	an.data('processingStarted', { id: '#dlrom' });
	an.data('processingCompleted', { id: '#dlrom' });
	an.notice('processingCompleted', 'All done, {{num}} ROMs downloaded.', 5000);
	an.notice('processingFailed', 'Error downloading ROMs: {{err}}', 3600000);

	// fetchMissingRom() -> download()
	an.notice('ipdbDownloadStarted', 'IPDB: Downloading "{{filename}}"', 60000);
	an.notice('ipdbSearchStarted', 'IPDB: Searching ROMs for "{{name}}"', 60000);

}

VPinMAME.prototype.fetchMissingRom = function(table, callback) {

	var downloadedRoms = [];
	var that = this;

	/**
	 * Loops through a list of download links, checks if the file is already
	 * locally available and otherwise fetches it using the given download
	 * function.
	 *
	 * @param links List of download links
	 * @param engine How to download. "vpf" or "ipdb" for now.
	 * @param callback Callback function
	 */
	var checkAndDownload = function(links, engine, callback) {
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
	 */
	var checkSuccess = function(row, next) {
		if (row.rom) {
			logger.log('info', '[vpm] Updating table row with new ROM status...');
			row.updateAttributes({
				rom_file: fs.existsSync(settings.vpinmame.path + '/roms/' + row.rom + '.zip')
			}).success(function() {
				next(null, downloadedRoms);
			}).fail(next);

		} else {
			next(null, downloadedRoms);
		}
	};


	/**
	 * Downloads a file.
	 * @param link {Object} Contains: <tt>url</tt>, <tt>filename</tt>, <tt>title</tt>.
	 * @param folder Destination folder
	 * @param next Callback. Second argument is filename where saved.
	 */
	var download = function(link, folder, next) {

		that.emit('ipdbDownloadStarted', { filename: link.filename });
		logger.log('info', '[vpm] Downloading %s at %s...', link.title, link.url);
		var filepath = folder + '/' + link.filename;
		var stream = fs.createWriteStream(filepath);
		stream.on('close', function() {
			logger.log('info', '[vpm] Download complete, saved to %s.', filepath);
			next(null, filepath);
		});
		stream.on('error', function(err) {
			logger.log('error', '[vpm] Error downloading %s: %s', link.url, err);
		});
		request(link.url).pipe(stream);
	};

	var queue = function(link, folder, engine, reference, next) {
		var transfer = require('./transfer')(_app);
		transfer.queue({
			title: link.title,
			url: link.url,
			type: 'rom',
			engine: engine,
			reference: table.ipdb_no
		}, function(err, msg) {
			if (err) {
				logger.log('error', '[vpm] Error querying item "%s".', link.title);
				return next(err);
			}
			next(null, msg);
		});
	}

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
			checkAndDownload(links, 'vpf', function(err) {
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
			checkAndDownload(links, 'ipdb', function(err) {
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

}

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
}


module.exports = VPinMAME;