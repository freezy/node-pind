var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var async = require('async');
var events = require('events');
var filesize = require('filesize');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');

var vpf, vpm, extr;
var transferring = false;

function Transfer(app) {
	if ((this instanceof Transfer) === false) {
		return new Transfer(app);
	}
	events.EventEmitter.call(this);
	this.initAnnounce(app);

	vpf = require('./vpforums')(app);
	vpm = require('./vpinmame')(app);
	extr = require('./extract')(app);
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

	an.forward('transferSizeKnown');


}

/**
 * Executed when application starts. Resets all transfers in progress and
 * starts download queue if setting allows it.
 */
Transfer.prototype.initTransfers = function() {
	var that = this;
	// reset started downloads
	schema.sequelize.query('UPDATE transfers SET startedAt = NULL WHERE startedAt IS NOT NULL AND failedAt IS NULL AND completedAt IS NULL;').success(function(result) {
		if (settings.pind.startDownloadsAutomatically) {
			that.start(function() {});
		}
	});
}

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
	if (transferring) {
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
 * Resets failed downloads and restarts queue if setting allows it.
 *
 * @param callback Optional function to execute after completion, invoked with one arguments:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
Transfer.prototype.resetFailed = function(callback) {
	var that = this;
	// reset failed downloads
	schema.sequelize.query('UPDATE transfers SET startedAt = NULL, failedAt = NULL WHERE failedAt IS NOT NULL').success(function(result) {
		if (settings.pind.startDownloadsAutomatically) {
			that.start(function() {});
		}
		callback();
	}).error(callback);
}

/**
 * Adds a new transfer to the queue.
 * @param transfer Transfer object containing at least title, url, type, engine, reference and postAction.
 * @param callback Optional function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li><
 * 	    <li>{String} Success message on success.</li></ol>
 */
Transfer.prototype.queue = function(transfer, callback) {
	var that = this;
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

			var startDownload = function() {
				callback(null, 'Download successfully added to queue.');
				if (settings.pind.startDownloadsAutomatically) {
					that.start(function() {
						console.log('[transfer] Download queue finished.');
					});
				}
			};

			if (row.engine == 'vpf') {
				schema.VpfFile.find(row.reference).success(function(row) {
					if (row) {
						row.updateAttributes({ downloadQueuedAt: new Date() }).done(startDownload);
					} else {
						startDownload();
					}
				});
			}
		});
	});
};

/**
 * Starts the download queue.
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
			console.log('[transfer] ERROR: ' + err);
			if (first && callback) {
				return callback(err);
			}
			
		} else {
			if (result.alreadyStarted) {
				console.log('[transfer] Downloads are already active, returning.');
				if (first && callback) {
					callback(null, result);
				}
				return;
			}
			if (result.emptyQueue) {
				console.log('[transfer] Queue is empty, returning.');
				if (first && callback) {
					callback(null, result);
				}
				return;
			}
			console.log('[transfer] Next download is ready, starting.');

			// still announce that we've started, but not every item.
			if (first && callback) {
				callback(null, { ok: true });
			}
			first = false;

			// now to next item...
			that.next(cb);
		}
	};
	console.log('[transfer] Kicking off download queue.');
	that.next(cb);
}

/**
 * Starts the next download in the queue and handles the result.
 * @param callback
 * @returns {*}
 */
Transfer.prototype.next = function(callback) {
	if (transferring) {
		return callback(null, { alreadyStarted: true });
	}
	transferring = true;
	var that = this;
	schema.Transfer.all({ where: 'startedAt IS NULL', order: 'sort ASC' }).success(function(rows) {
		var found = false;
		if (rows.length > 0) {

			// loop until we find an engine we support...
			rowsloop:
			for (var i = 0; i < rows.length; i++) {
				var row = rows[i];
				switch (row.engine) {
					case 'vpf': {

						// found a hit. now update "started" clock..
						console.log('[transfer] Starting download of %s', row.url);
						row.updateAttributes({ startedAt: new Date()}).success(function(row) {
							var vpfFile;

							// update file size as soon as we receive the content length.
							vpf.on('contentLengthReceived', function(data) {
								if (data.reference.id) {
									schema.Transfer.find(data.reference.id).success(function(row) {
										if (row) {
											row.updateAttributes({ size: data.contentLength });
										}
									});
									that.emit('transferSizeKnown', {
										id: data.reference.id,
										size: data.contentLength,
										displaySize: filesize(data.contentLength, true)
									});
								}
							});

							// now start the download at VPF
							vpf.download(row, settings.pind.tmp, row, function(err, filepath) {

								// on error, update db with error and exit
								if (err) {
									that.emit('transferFailed', { error: err, transfer: row });
									return row.updateAttributes({
										failedAt: new Date(),
										result: JSON.stringify({ error: err })
									}).done(function() {
										transferring = false;
										callback(err);
									});
								}

								// otherwise, update db with success and extract
								row.updateAttributes({
									completedAt: new Date(),
									result: JSON.stringify({ extracting: filepath }),
									size: fs.fstatSync(fs.openSync(filepath, 'r')).size

								}).success(function() {
									that.emit('transferCompleted', { file: filepath, transfer: row });

									// now, extract
									extr.extract(filepath, null, function(err, extractResult) {
										// on error, update db with error and exit
										if (err) {
											that.emit('extractFailed', { error: err, transfer: row });
											return row.updateAttributes({
												failedAt: new Date(),
												result: err
											}).success(function() {
												transferring = false;
												callback(err);
											});
										}

										// update extract result and we're clear.
										row.updateAttributes({
											result: JSON.stringify(extractResult)
										}).success(function(row) {
											that.emit('extractCompleted', { result: extractResult, transfer: row });
											transferring = false;
											callback(null, row);
										});
									});

								});
							});

						});
						found = true;
						break rowsloop;
					}
					default: {
						console.log('[transfer] Skipping unsupported engine "' + row.engine + '".');
					}
				}
			}
			if (!found) {
				transferring = false;
				callback(null, { emptyQueue: true });
			}
		} else {
			transferring = false;
			callback(null, { emptyQueue: true });
		}
	});
};

Transfer.prototype.postProcess = function(transfer, callback) {
	if (!transfer.postAction) {
		return callback();
	}

	var action = JSON.parse(transfer.postAction);
	if (transfer.type == 'table') {

		var actions = [];
		var availableActions = ['addtohp', 'dlrom', 'dlmedia', 'dlvideo'];
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
					console.log('[transfer] Added ' + downloadedRoms.length + ' ROMs to the download queue.');
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
						console.log('[transfer] Successfully extracted ' + files.length + ' media files.');
						fs.unlinkSync(filepath);
						next();
					});
				})
			}

			// otherwise just continue
			else {
				console.log('[transfer] Unimplemented action: %s', action);
				next();
			}
		}, callback);

	} else {
		callback();
	}
};

module.exports = Transfer;
