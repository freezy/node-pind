var fs = require('fs');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');

var socket;

module.exports = function(app) {
	socket = app.get('socket.io');
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