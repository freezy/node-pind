var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var async = require('async');
var events = require('events');
var logger = require('winston');
var filesize = require('filesize');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');

var vpf, vpm, ipdb, extr;
var transferring = { vpf: [], ipdb: [] };
var progress = { };

function Transfer(app) {
	if ((this instanceof Transfer) === false) {
		return new Transfer(app);
	}
	events.EventEmitter.call(this);
	this.initAnnounce(app);

	vpf = require('./vpforums')(app);
	vpm = require('./vpinmame')(app);
	ipdb = require('./ipdb')(app);
	extr = require('./extract')(app);

	vpf.on('downloadWatch', function(data) {
		progress[data.reference.id] = data.size / data.contentLength;
	});
}
util.inherits(Transfer, events.EventEmitter);


/**
 * Sets up event listener for realtime updates via Socket.IO.
 * @param app Express application
 */
Transfer.prototype.initAnnounce = function(app) {
	var an = require('./announce')(app, this);

	an.transferUpdate('transferFailed');
	an.transferUpdate('transferCompleted');
	an.transferUpdate('extractFailed');
	an.transferUpdate('extractCompleted');

	an.forward('transferAdded');
	an.forward('transferDeleted');
	an.forward('transferSizeKnown');
	an.forward('transferClearedFailed');

	an.downloadWatch('downloadWatch');
};

/**
 * Executed when application starts. Resets all transfers in progress and
 * starts download queue if setting allows it.
 */
Transfer.prototype.initTransfers = function() {
	var that = this;
	// reset started downloads
	schema.sequelize.query('UPDATE transfers SET startedAt = NULL WHERE startedAt IS NOT NULL AND failedAt IS NULL AND completedAt IS NULL;').success(function() {
		if (settings.pind.startDownloadsAutomatically) {
			that.start(function() {});
		}
	});
};

/**
 * Returns the status of the current queue. Can be on of:
 *   <ol><li><tt>idling</tt> - Empty queue, nothing is transferring.</li>
 *       <li><tt>transferring</tt> - Currently transferring an item.</li>
 *       <li><tt>paused</tt> - A transfer has been explicitly paused (unsupported).</li>
 *       <li><tt>stopped</tt> - No automatic transfers or transfer has been explicitly stopped.</li>
 *   </ol>
 *
 * @param callback Optional function to execute after download started (not finished), invoked with one argumens:
 * 	<ol><li>{String} Error message on error</li>
 *      <li>{String} One of: <tt>idle</tt>, <tt>transferring</tt>, <tt>paused</tt>, <tt>stopped</tt>.
 */
Transfer.prototype.getStatus = function(callback) {

	if (transferring.vpf.length > 0) {
		return callback(null, 'transferring');
	}
	schema.Transfer.count({ where: 'startedAt IS NULL'}).success(function(num) {
		if (num == 0) {
			callback(null, 'idling');
		} else {
			callback(null, 'stopped');
		}
	});
};

/**
 * Returns a dictionary of all the progresses of the current downloads.
 * Key is transfer ID, value is progress from 0 to 1.
 * @returns {Object} Progresses of all current downloads.
 */
Transfer.prototype.getCurrentProgress = function() {
	return progress;
};

/**
 * Resets failed downloads and restarts queue if setting allows it.
 *
 * @param callback Optional function to execute after completion, invoked with one arguments:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
Transfer.prototype.resetFailed = function(callback) {
	var that = this;
	// reset failed downloads
	schema.sequelize.query('UPDATE transfers SET startedAt = NULL, failedAt = NULL WHERE failedAt IS NOT NULL').success(function() {
		if (settings.pind.startDownloadsAutomatically) {
			that.start(function() {});
		}
		that.emit('transferClearedFailed');
		callback();
	}).error(callback);
};

/**
 * Deletes a transfer.
 * @param id ID of transfer to delete
 * @param callback
 */
Transfer.prototype.delete = function(id, callback) {
	var that = this;
	// delete from db
	schema.Transfer.find(id).success(function(row) {
		if (row) {
			row.destroy().success(function() {
				that.emit('transferDeleted', { id: id });
				callback();
			});
		} else {
			callback('Cannot find VPF file with ID "' + id + '".');
		}
	});
};

/**
 * Adds a new transfer to the queue.
 * @param transfer Transfer object containing at least title, url, type, engine, reference and postAction.
 * @param callback Optional function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li><
 * 	    <li>{String} Success message on success.</li></ol>
 */
Transfer.prototype.queue = function(transfer, callback) {
	var that = this;
	if (!transfer.type || !transfer.engine || !transfer.url || !transfer.title) {
		throw new Error('The following fields of a transfer must be set: "type", "engine", "url" and "title", got: ' + util.inspect(transfer));
	}
	if (!transfer.postAction) {
		transfer.postAction = '{}';
	}
	if (_.isObject(transfer.postAction)) {
		transfer.postAction = JSON.stringify(transfer.postAction);
	}
	schema.Transfer.all({ where: {
		type: transfer.type,
		engine: transfer.engine,
		reference: transfer.reference
	}}).success(function(rows) {
		if (rows.length > 0) {
			return callback('Item already queued.');
		}
		transfer.sort = +new Date();
		schema.Transfer.create(transfer).success(function(row) {

			that.emit('transferAdded', { transfer: row });

			callback(null, 'Added "' + transfer.title + '" successfully to queue.');
			if (settings.pind.startDownloadsAutomatically) {
				that.start(function() {
					logger.log('info', '[transfer] Download queue finished.');
				});
			}
		});
	});
};

/**
 * Kicks off the download queue.
 *
 * @param callback Optional function to execute after download started (not finished), invoked with one argumens:
 * 	<ol><li>{String} Error message on error</li>
 *      <li>{Object} Result with attribues: <tt>alreadyStarted</tt> or <tt>emptyQueue</tt>.</li></ol>
 */
Transfer.prototype.start = function(callback) {
	var that = this;
	var first = false;
	var cb = function(err, result) {
		if (err) {
			logger.log('error', '[transfer] ERROR: ' + err);
			if (first && callback) {
				return callback(err);
			}

		} else {
			if (result.emptyQueue) {
				logger.log('info', '[transfer] Queue is empty, returning.');
				if (first && callback) {
					callback(null, result);
				}
				return;
			}
			logger.log('info', '[transfer] Next download is ready, starting.');

			// still announce that we've started, but not every item.
			if (first && callback) {
				callback(null, { ok: true });
			}
			first = false;

			// now to next item...
			that.next(cb);
		}
	};
	logger.log('info', '[transfer] Kicking off download queue.');
	that.next(cb);
};

/**
 * Starts the next download in the queue and handles the result.
 * @param callback Executed at the end of each download or instantly when on download was started.
 * @returns {*}
 */
Transfer.prototype.next = function(callback) {

	var that = this;
	schema.Transfer.all({ where: 'startedAt IS NULL', order: 'sort ASC' }).success(function(transfers) {
		if (transfers.length > 0) {
			var downloadStarted = false;

			var download = function(transfer, modulename, moduleRef) {

				downloadStarted = true;

				// update "started" clock..
				logger.log('info', '[transfer] [%s] Starting download of %s', modulename, transfer.url);
				transfer.updateAttributes({ startedAt: new Date()}).success(function(row) {

					// update file size as soon as we receive the content length.
					vpf.on('contentLengthReceived', function(data) {
						if (data.reference.id) {
							schema.Transfer.find(data.reference.id).success(function(row) {
								if (row) {
									row.updateAttributes({ size: data.contentLength });
									logger.log('info', '[transfer] [%s] Updating size of transfer %s to %s.', modulename, data.reference.id, data.contentLength);
									that.emit('transferSizeKnown', {
										id: data.reference.id,
										size: data.contentLength,
										displaySize: filesize(data.contentLength, true)
									});

								} else {
									logger.log('error', '[transfer] [%s] Could not find transfer with id %s for updating size to %s.', modulename, data.reference.id, data.contentLength);
								}
							});

						}
					});

					// now start the download at VPF
					moduleRef.download.call(moduleRef, row, that, function(err, filepath) {

						// free up slot
						transferring[modulename] = _.reject(transferring[modulename], function(t) {
							return t.id == transfer.id;
						});
						delete progress[transfer.id];

						// on error, update db with error and exit
						if (err) {
							that.emit('transferFailed', { error: err, transfer: row });
							return row.updateAttributes({
								failedAt: new Date(),
								result: JSON.stringify({ error: err })
							}).done(function() {
									callback(err);
								});
						}

						// otherwise, update db with success and extract
						var fd = fs.openSync(filepath, 'r');
						var size = fs.fstatSync(fd).size;
						fs.closeSync(fd);
						row.updateAttributes({
							completedAt: new Date(),
							result: JSON.stringify({ downloaded: filepath }),
							size: size

						}).success(function(row) {
							that.emit('transferCompleted', { file: filepath, transfer: row });
							that.postDownload(filepath, row, callback);
						});
					});
				});
			};

			// loop through transfers
			for (var i = 0; i < transfers.length; i++) {
				var transfer = transfers[i];
				switch (transfer.engine) {
					case 'vpf': {

						// found a hit. check if there are download slots available:
						if (transferring.vpf.length < settings.vpforums.numConcurrentDownloads) {
							transferring.vpf.push(transfer);
							download(transfer, 'vpf', vpf);
						}
					}
					break;
					case 'ipdb': {

						// found a hit. check if there are download slots available:
						if (transferring.ipdb.length < settings.ipdb.numConcurrentDownloads) {
							transferring.ipdb.push(transfer);
							download(transfer, 'ipdb', ipdb);
						}
					}
					break;
					default: {
						logger.log('warn', '[transfer] Skipping unsupported engine "%s".', transfer.engine);
					}
				}
			}
			// assure callback
			if (!downloadStarted) {
				callback(null, { emptyQueue: true });
			}
		} else {
			callback(null, { emptyQueue: true });
		}
	});
};

Transfer.prototype.postDownload = function(filepath, transfer, callback) {
	var that = this;
	var result;

	switch (transfer.type) {
		case 'rom': {
			var dest = settings.vpinmame.path + '/roms/' + transfer.filename;
			if (!fs.existsSync(dest)) {
				logger.log('info', '[transfer] Moving downloaded ROM from %s to %s.', filepath, dest);
				fs.renameSync(filepath, dest);
				result = { moved: { src: filepath, dest: dest }};
			} else {
				logger.log('info', '[transfer] ROM at %s already exists, deleting %s.', dest, filepath);
				fs.unlinkSync(filepath);
				result = { deleted: filepath };
			}

			// update extract result and we're clear.
			transfer.updateAttributes({
				result: JSON.stringify(result)
			}).success(function(row) {
				callback(null, row);
			});
		}
		break;
		case 'table':
		default: {
			extr.extract(filepath, null, function(err, extractResult) {
				// on error, update db with error and exit
				if (err) {
					that.emit('extractFailed', { error: err, transfer: row });
					return transfer.updateAttributes({
						failedAt: new Date(),
						result: err
					}).success(function() {
						callback(err);
					});
				}

				// update extract result and we're clear.
				transfer.updateAttributes({
					result: JSON.stringify(extractResult)
				}).success(function(row) {
					that.emit('extractCompleted', { result: extractResult, transfer: row });
					callback(null, row);
				});
			});
		}
		break;
	}

}

Transfer.prototype.postProcess = function(transfer, callback) {
	if (!transfer.postAction) {
		return callback();
	}

	var action = JSON.parse(transfer.postAction);

	// transfer type: TABLE
	if (transfer.type == 'table') {

		var actions = [];
		var availableActions = ['addtohp', 'dlrom', 'dlmedia', 'dlvideo']; // order is important
		var table = {
			name: schema.VpfFile.splitName(transfer.title)[0],
			platform: 'VP'
		};

		// explode checked actions into array
		for (var i = 0; i < availableActions.length; i++) {
			if (action[availableActions[i]]) {
				actions.push(availableActions[i]);
			}
		}

		// process checked actions
		async.eachSeries(actions, function(action, next) {

			// download ROM
			if (action == 'dlrom') {
				vpm.fetchMissingRom(table, function(err, downloadedRoms) {
					if (err) {
						return next(err);
					}
					logger.log('info', '[transfer] Added %d ROMs to the download queue.', downloadedRoms.length);
					next();
				});
			}

			// download media
			else if (action == 'dlmedia') {
				vpf.findMediaPack(table, function(err, filepath) {
					if (err) {
						return next(err);
					}
					extr.extract(filepath, table.hpid ? table.hpid : null, function(err, files) {
						if (err) {
							return next(err);
						}
						logger.log('info', '[transfer] Successfully extracted %d media files.', files.length);
						fs.unlinkSync(filepath);
						next();
					});
				})
			}

			// otherwise just continue
			else {
				logger.log('info', '[transfer] Unimplemented action: %s', action);
				next();
			}
		}, callback);

	} else {
		callback();
	}
};

Transfer.prototype.watchDownload = function(filename, contentLength, reference) {
	if (!this.watches) {
		this.watches = {};
	}
	if (!this.openFiles) {
		this.openFiles = {};
	}
	var that = this;
	var fd = fs.openSync(filename, 'r');
	this.openFiles[filename] = fd;
	this.watches[filename] = setInterval(function() {
		var size = fs.fstatSync(fd).size;
		that.emit('downloadWatch', { size: size, contentLength: contentLength, reference: reference });

	}, settings.pind.downloaderRefreshRate);
};

Transfer.prototype.unWatchDownload = function(filename) {
	if (!this.watches[filename]) {
		return;
	}
	clearInterval(this.watches[filename]);
	fs.closeSync(this.openFiles[filename]);
	delete this.watches[filename];
	delete this.openFiles[filename];
};

module.exports = Transfer;
