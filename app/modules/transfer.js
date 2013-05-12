var _ = require('underscore');
var fs = require('fs');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');

var socket, vpf, extr;

var transferring = false;

module.exports = function(app) {
	socket = app.get('socket.io');
	vpf = require('./vpforums')(app);
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