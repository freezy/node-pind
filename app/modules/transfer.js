var _ = require('underscore');
var fs = require('fs');
var async = require('async');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');

var socket, vpf, vpm, extr;

var transferring = false;

module.exports = function(app) {
	socket = app.get('socket.io');
	vpf = require('./vpforums')(app);
	vpm = require('./vpinmame')(app);
	extr = require('./extract')(app);
	return exports;
};

exports.queue = function(transfer, callback) {
	schema.Transfer.all({ where: {
		type: transfer.type,
		engine: transfer.engine,
		reference: transfer.reference
	}}).success(function(rows) {
		if (rows.length > 0) {
			return callback('Item already queued.');
		}
		schema.Transfer.create(transfer).success(function(row) {
			callback(null, "Download successfully added to queue.");
		});
	})
};

/**
 * Starts the next download in the queue.
 * @param callback
 * @returns {*}
 */
exports.next = function(callback) {
	if (transferring) {
		return callback(null, { alreadyStarted: true });
	}
	schema.Transfer.all({ where: 'started IS NULL', order: 'createdAt ASC' }).success(function(rows) {
		var found = false;
		if (rows.length > 0) {

			// loop until we find an engine we support...
			rowsloop:
			for (var i = 0; i < rows.length; i++) {
				var row = rows[i];
				switch (row.engine) {
					case 'vpf': {

						// found a hit. now update "started" clock..
						console.log('Starting download of %s', row.url);
						row.updateAttributes({ started: new Date()}).success(function(row) {

							// now start the download
							vpf.download(row, settings.pind.tmp, function(err, filepath) {

								// on error, update db with error and exit
								if (err) {
									return row.updateAttributes({
										failed: new Date(),
										result: err
									}).success(function() {
										callback(err);
									});
								}

								// otherwise, update db with success and extract
								row.updateAttributes({
									completed: new Date(),
									result: JSON.stringify({ extracting: filepath }),
									size: fs.fstatSync(fs.openSync(filepath, 'r')).size
								}).success(function() {

									// now, extract
									extr.extract(filepath, null, function(err, extractResult) {
										// on error, update db with error and exit
										if (err) {
											return row.updateAttributes({
												failed: new Date(),
												result: err
											}).success(function() {
												callback(err);
											});
										}

										// update extract result and we're clear.
										row.updateAttributes({
											result: JSON.stringify(extractResult)
										}).done(callback);
									});
								});
							});
						});
						found = true;
						break rowsloop;
					}
					default: {
						console.log('Skipping unsupported engine "' + row.engine + '".');
					}
				}
			}
			if (!found) {
				callback(null, { emptyQueue: true });
			}
		} else {
			callback(null, { emptyQueue: true });
		}
		
	});
};

exports.postProcess = function(transfer, callback) {
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
						console.log('Successfully extracted ' + files.length + ' media files.');
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