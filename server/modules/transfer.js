'use strict';

var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var path = require('path');
var async = require('async');
var events = require('events');
var logger = require('winston');
var filesize = require('filesize');

var settings = require('../../config/settings-mine');
var schema = require('../database/schema');

var an = require('./announce');
var vp = require('./visualpinball');
var vpf = require('./vpforums');
var vpm = require('./vpinmame');
var extr = require('./extract');
var ipdb = require('./ipdb');

var transferring = { vpf: [], ipdb: [] };
var aborting = false;
var downloadStarted = false;
var progress = { };

function Transfer() {
	events.EventEmitter.call(this);
	this.initAnnounce();
	this.on('transferProgress', function(data) {
		progress[data.reference.id] = data.size / data.contentLength;
	});
}
util.inherits(Transfer, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 */
Transfer.prototype.initAnnounce = function() {

	var ns = 'transfer';

	an.notice(this, 'transferAborted', 'All transfers aborted.', 'admin', 5000);

	an.transferUpdate(this, 'transferFailed', ns);
	an.transferUpdate(this, 'transferCompleted', ns);
	an.transferUpdate(this, 'extractFailed', ns);
	an.transferUpdate(this, 'extractCompleted', ns);

	an.forward(this, 'dataUpdated', null, 'admin');

	an.forward(this, 'transferAdded', ns, 'admin');
	an.forward(this, 'transferDeleted', ns, 'admin');
	an.forward(this, 'transferAborted', ns, 'admin');
	an.forward(this, 'transferSizeKnown', ns, 'admin');
	an.forward(this, 'transferClearedFailed', ns, 'admin');
	an.forward(this, 'transferOrderChanged', ns, 'admin');
	an.forward(this, 'statusUpdated', null, 'admin');

	an.transferProgress(this, 'transferProgress', ns);

	var that = this;
	var queue = function(transfer) {
		that.queue(transfer, function(err) {
			if (err) {
				return logger.log('error', '[transfer] ERROR: %s', err);
			}
			logger.log('info', '[transfer] Queued "%s" via event.', transfer.title);
		});
	};
	vpf.on('queueTransfer', queue);
	vpm.on('queueTransfer', queue);
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
	if (aborting) {
		return callback(null, 'stopped');
	}
	schema.Transfer.count({ where: 'startedAt IS NULL'}).success(function(num) {
		if (num == 0) {
			callback(null, 'idling');
		} else {
			callback(null, 'stopped');
		}
	});
};

Transfer.prototype.control = function(action, callback) {

	var that = this;
	switch (action) {
		case 'start': {
			aborting = false;
			this.start(function(err, result) {
				if (!err && result.ok) {
					that.emit('statusUpdated');
				}
			});
			break;
		}
		case 'pause': {

			break;
		}
		case 'stop': {
			aborting = true;
			that.emit('statusUpdated');
			vpf.abortDownloads();
			break;
		}
		default:
			res(error.api('Unknown action: "' + params.action + '".'));
	}
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
		that.emit('dataUpdated', { resource: 'transfer' });
		that.emit('statusUpdated');
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
				that.emit('statusUpdated');
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
	transfer.sort = +new Date();
	schema.Transfer.find({ where: [ 'url = ? AND startedAt IS NULL', transfer.url ]}).success(function(row) {
		if (row) {
			logger.log('info', '[transfer] Transfer with URL "%s" already added, skipping.', transfer.url);
			return callback(null, 'Skipped "' + transfer.title + '" since it is already in the queue.');
		}
		schema.Transfer.create(transfer).success(function(row) {

			that.emit('transferAdded', { transfer: row });

			callback(null, 'Added "' + transfer.title + '" successfully to queue.');
			that.emit('statusUpdated');
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
			if (result && result.emptyQueue) {
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
 *
 * Once the download is finished, it runs postDownload(), which extracts the files
 * and basically completes the download process. However, postDownload() also calls
 * postProcess(), which executes potential actions such as ROM search for a table, etc.
 *
 * @param callback Executed at the end of each download or instantly when on download was started.
 * @returns {*}
 */
Transfer.prototype.next = function(callback) {

	var that = this;
	schema.Transfer.all({ where: 'startedAt IS NULL', order: 'sort ASC' }).success(function(transfers) {
		if (transfers.length > 0) {

			if (aborting) {
				return callback(null, { aborted: true });
			}

			// loop through transfers
			for (var i = 0; i < transfers.length; i++) {
				if (aborting) {
					return callback(null, { aborted: true });
				}
				var transfer = transfers[i];
				switch (transfer.engine) {
					case 'vpf': {

						// found vpf hit. check if there are download slots available:
						if (transferring.vpf.length < settings.vpforums.numConcurrentDownloads) {
							transferring.vpf.push(transfer);
							that._download(transfer, 'vpf', vpf, callback);
						}
					}
					break;
					case 'ipdb': {

						// found ipdb hit. check if there are download slots available:
						if (transferring.ipdb.length < settings.ipdb.numConcurrentDownloads) {
							transferring.ipdb.push(transfer);
							that._download(transfer, 'ipdb', ipdb, callback);
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
			that.emit('statusUpdated');
			callback(null, { emptyQueue: true });
		}
	});
};

/**
 * Uses provided module to download a transfer.
 *
 * @param transfer
 * @param moduleName
 * @param moduleRef
 * @param callback
 * @private
 */
Transfer.prototype._download = function(transfer, moduleName, moduleRef, callback) {

	var that = this;
	downloadStarted = true;

	// update "started" clock..
	logger.log('info', '[transfer] [%s] Starting download of %s', moduleName, transfer.url);
	transfer.updateAttributes({ startedAt: new Date()}).success(function(row) {
		that.emit('statusUpdated');

		// update file size as soon as we receive the content length.
		moduleRef.once('contentLengthReceived', function(data) {
			if (data.reference.id) {
				schema.Transfer.find(data.reference.id).success(function(row) {
					if (row) {
						row.updateAttributes({ size: data.contentLength });
						logger.log('info', '[transfer] [%s] Updating size of transfer %s to %s.', moduleName, data.reference.id, data.contentLength);
						that.emit('transferSizeKnown', {
							id: data.reference.id,
							size: data.contentLength,
							displaySize: filesize(data.contentLength, true)
						});

					} else {
						logger.log('error', '[transfer] [%s] Could not find transfer with id %s for updating size to %s.', moduleName, data.reference.id, data.contentLength);
					}
				});
			}
		});

		moduleRef.once('filenameReceived', function(data) {
			if (data.reference.id) {
				schema.Transfer.find(data.reference.id).success(function(row) {
					if (row) {
						row.updateAttributes({ filename: data.filename });
						logger.log('info', '[transfer] [%s] Updating database with new filename "%s" for id %d.', moduleName, data.filename, row.id);
					} else {
						logger.log('error', '[transfer] [%s] Could not find transfer with id %s for updating filename to "%s".', moduleName, data.reference.id, data.filename);
					}
				});
			}
		});

		if (aborting) {
			return callback(null, { aborted: true });
		}

		// now start the download
		moduleRef.download.call(moduleRef, row, that, function(err, filepath) {

			// free up slot
			transferring[moduleName] = _.reject(transferring[moduleName], function(t) {
				return t.id == transfer.id;
			});
			delete progress[transfer.id];

			// if aborting, reset status and return.
			if (aborting) {
				return schema.sequelize.query('UPDATE transfers SET startedAt = null WHERE id = ' + row.id).success(function() {
					that.emit('transferAborted', { id: row.id });
				});
			}

			// on error, update db with error and exit
			if (err) {
				that.emit('transferFailed', { error: err, transfer: row });
				return row.updateAttributes({
					failedAt: new Date(),
					result: JSON.stringify({ error: err })
				}).done(function() {
					callback(null, { failed: true });
				});
			}

			// otherwise, update db with success and run post download
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

/**
 * Extracts (or moves) a downloaded file to the correct location.
 *
 * @param filepath Downloaded file
 * @param transfer Transfer from database
 * @param callback Callback, passed from caller
 */
Transfer.prototype.postDownload = function(filepath, transfer, callback) {
	var that = this;
	var result;

	switch (transfer.type) {
		case 'rom': {
			var dest = settings.vpinmame.path + '/roms/' + transfer.filename;
			if (!fs.existsSync(dest)) {
				logger.log('info', '[transfer] Moving downloaded ROM from %s to %s.', filepath, dest);
				fs.renameSync(filepath, dest);
				result = { saved: { src: filepath, dst: dest }};
			} else {
				logger.log('info', '[transfer] ROM at %s already exists, deleting %s.', dest, filepath);
				fs.unlinkSync(filepath);
				result = { deleted: filepath };
			}

			// update extract result and we're clear.
			transfer.updateAttributes({
				result: JSON.stringify(result)
			}).success(function(row) {
				that.postProcess(row, callback);
			});
		}
		break;
		case 'table':
		default: {
			extr.extract(filepath, null, function(err, extractResult) {
				// on error, update db with error and exit
				if (err) {
					that.emit('extractFailed', { error: err, transfer: transfer });
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
					that.postProcess(row, callback);
				});
			});
		}
		break;
	}

};

/**
 * Executes eventual post actions, such as search for ROMs, media etc.
 *
 * @param transfer
 * @param callback
 * @returns {*}
 */
Transfer.prototype.postProcess = function(transfer, callback) {
	if (!transfer.postAction) {
		return callback(null, transfer);
	}

	logger.log('info', '[transfer] Starting post processing of transfer "%s".', transfer.title);

	var action = JSON.parse(transfer.postAction);
	var result = JSON.parse(transfer.result);
	var that = this;

	var tableActions = function(table, callback) {

		var availableActions = ['addtohp', 'dlrom', 'dlmedia', 'dlvideo']; // order is important
		var actions = _.filter(availableActions, function(a) {
			return action[a];
		});

		// process checked actions
		async.eachSeries(actions, function(action, next) {

			var done = function() {
				that.emit('dataUpdated', { resource: 'transfer' });
				that.emit('statusUpdated');
				next();
			};

			switch (action) {

				// download ROM
				case 'dlrom':
					vpm.fetchMissingRom(table, function(err, downloadedRoms) {
						if (err) {
							return next(err);
						}
						logger.log('info', '[transfer] Added %d ROMs to the download queue.', downloadedRoms.length);
						done();
					});
					break;

				// download media
				case 'dlmedia':
					vpf.findMediaPack(table, done);
					break;

				case 'dlvideo':
					vpf.findTableVideo(table, done);
					break;

				// otherwise just continue
				default:
					logger.log('warn', '[transfer] Skipping unimplemented action: %s', action);
					next();
			}

		}, callback);
	};

	// transfer type: TABLE
	if (transfer.type == 'table') {

		// 1. find reference
		if (transfer.engine == 'vpf') {
			schema.VpfFile.find(transfer.reference).success(function(vpffile) {
				if (!vpffile) {
					logger.log('warn', '[transfer] Skipping post process for %s because cannot find referenced row %d in VpfFile table.', transfer.title, transfer.reference);
					return callback(null, transfer);
				}
				vpffile = vpffile.map();
				var filename, filepath;
				if (result && (result.extract || result.skip)) {
					var files = _.extend(result.extract ? result.extract : {}, result.skip);
					for (var name in files) {
						if (path.extname(name).toLowerCase() == '.vpt' && files.hasOwnProperty(name)) {
							filename = path.basename(name, path.extname(name));
							filepath = files[name].dst;
							break;
						}
					}
					if (!filepath) {
						logger.log('warn', '[transfer] Unable to retrieve extracted file from result: %s', transfer.result);
					}
				} else {
					logger.log('warn', '[transfer] No result or no extract info in transfer result: %s', transfer.result);
				}

				// 2. try to match at ipdb
				ipdb.enrich({
					name: vpffile.title_trimmed,
					manufacturer: vpffile.manufacturer,
					year: vpffile.year,
					platform: 'VP',
					filename: filename
				}, function(err, table) {

					if (!err && table.ipdb_no) {
						schema.Table.updateOrCreate({ where: { ipdb_no: table.ipdb_no }}, table, function(err, table) {
							if (err) {
								logger.log('warn', '[transfer] Error adding to tables: %s', err);
								return callback(err);
							}

							// 3. analyze table data
							if (filepath) {
								vp.getTableData(filepath, function(err, attrs) {
									if (err) {
										logger.log('warn', '[transfer] Error reading vpt data: %s', err);
										return callback(err);
									}
									table.updateAttributes(attrs).success(function(table) {

										// 4. continue with optional post actions.
										tableActions(table, callback);

									});
								});

							} else {
								// 4. continue with optional post actions.
								tableActions(table, callback);
							}

						});
					} else {
						logger.log('warn', '[transfer] No ipdb match, ignoring for now.');
						return callback(null, transfer);
					}
				});

			});
		} else {
			logger.log('warn', '[transfer] Skipping post process for %s due to unimplemented engine %s.', transfer.title, transfer.engine);
			return callback(null, transfer);
		}
	} else {
		callback(null, transfer);
	}
};

Transfer.prototype.reorder = function(id, prevId, nextId, callback) {

	var that = this;
	schema.Transfer.find(id).success(function(row) {

		if (!row) {
			return callback('No transfer found with ID "' + id + '".');
		}
		var ids = _.reject([nextId, prevId], function(num) {
			return num == 0;
		});

		schema.Transfer.all({ where: { id: ids }}).success(function(rows) {
			var prev, next;

			// item has been dropped between 2 rows: easy
			if (prevId && nextId) {
				if (rows.length != 2) {
					return callback('One of ' + ids + ' is not in database.');
				}
				prev = rows[0].id == prevId ? rows[0] : rows[1];
				next = rows[1].id == nextId ? rows[1] : rows[0];
				row.updateAttributes({
					sort: Math.round((prev.sort + next.sort) / 2)
				});
			}
			// item has been dropped on top of the list (could be page 2+ though)
			if (!prevId && nextId) {
				next = rows[0];
				// find prev item
				schema.Transfer.find({ where: [ 'sort < ?', next.sort], limit: 1 }).success(function(prev) {
					var prevSort = prev ? prev.sort : next.sort - 1024;
					row.updateAttributes({
						sort: Math.round((prevSort + next.sort) / 2)
					});
				});
			}

			// item has been dropped on bottom of the list (could be more items on next page)
			if (prevId && !nextId) {
				prev = rows[0];
				// find prev item
				schema.Transfer.find({ where: [ 'sort > ?', prev.sort], limit: 1 }).success(function(next) {
					var nextSort = next ? next.sort : prev.sort + 1024;
					row.updateAttributes({
						sort: Math.round((prev.sort + nextSort) / 2)
					});
				});
			}
			that.emit('transferOrderChanged', ids);
			callback();
		});

	});
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
		that.emit('transferProgress', { size: size, contentLength: contentLength, reference: reference });

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

module.exports = new Transfer();
