var fs = require('fs');
var util = require('util');
var async = require('async');
var events = require('events');
var request = require('request');

var schema = require('../model/schema');
var settings = require('../../config/settings-mine');

var ipdb, vpf;

var isFetchingRoms = false;


function VPinMAME(app) {
	if ((this instanceof VPinMAME) === false) {
		return new VPinMAME(app);
	}
	events.EventEmitter.call(this);
	this.initAnnounce(app);

	ipdb = require('./ipdb')(app);
	vpf = require('./vpforums')(app);
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
	 * @param downloadFct Download function. Args are link object, destination folder and callback
	 * @param callback Callback function
	 */
	var checkAndDownload = function(links, downloadFct, callback) {
		async.eachSeries(links, function(link, next) {
			if (!fs.existsSync(settings.vpinmame.path + '/roms/' + link.filename)) {
				downloadFct(link, settings.vpinmame.path + '/roms', function(err, filepath) {
					downloadedRoms.push(filepath);
					next();
				});
			} else {
				console.log('ROM %s already available, skipping.', link.filename);
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
			console.log('Updating table row with new ROM status...');
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
		console.log('Downloading %s at %s...', link.title, link.url);
		var filepath = folder + '/' + link.filename;
		var stream = fs.createWriteStream(filepath);
		stream.on('close', function() {
			console.log('Download complete, saved to %s.', filepath);
			next(null, filepath);
		});
		stream.on('error', function(err) {
			console.log('Error downloading %s: %s', link.url, err);
		});
		request(link.url).pipe(stream);
	};

	/**
	 * Downloads all ROMs from vpforums.org (that don't exist already).
	 * @param table Tables row from database
	 * @param next Callback
	 */
	var downloadVPF = function(table, next) {
		vpf.getRomLinks(table, function(err, links) {
			if (err) {
				console.log('ERROR: ' + err);
				return next(err);
			}
			checkAndDownload(links, vpf.download, function(err) {
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
			console.log('IPDB ROMS: %s', util.inspect(links));
			if (err) {
				console.log('ERROR: ' + err);
				return next(err);
			}
			checkAndDownload(links, download, function(err) {
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
		console.log('WARNING: ROM file found in table but no IPDB ID. Maybe try matching IPDB.org first?');
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

	console.log('Fetching tables with no ROM file...')
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