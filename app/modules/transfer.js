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

exports.start = function(callback) {
	if (transferring) {
		return callback(null, { alreadyStarted: true });
	}
	schema.Transfer.all({ where: 'started IS NULL', order: 'createdAt ASC' }).success(function(rows) {
		if (rows.length > 0) {
			rowsloop:
			for (var i = 0; i < rows.length; i++) {
				var row = rows[i];
				switch (row.engine) {
					case 'vpf': {
						console.log('Starting download of %s', row.url);	
						vpf.download(row, settings.pind.tmp, function(err, filepath) {
							if (err) {
								return callback(err);
							}
							extr.extract(filepath, null, function(err, extractedFiles) {
								if (err) {
									return callback(err);
								}


							});
						});
						break rowsloop;
					}
					default: {
						console.log('Skipping unsupported engine "' + row.engine + '".');
					}
				}
			}
			callback(null, {});
		} else {
			callback(null, { emptyQueue: true });
		}
		
	});
};