var util = require('util');

error = require('../error');
var schema = require('../../model/schema');

var transfer;

module.exports = function(app) {
	transfer = require('./../transfer')(app);
	return exports;
};

var TransferApi = function() {
	return {
		name : 'Transfer',

		AddVPFTable : function(req, params, callback) {
			schema.VpfFile.find(params.id).success(function(row) {
				if (row) {
					transfer.queue({
						title: row.title,
						url: 'http://www.vpforums.org/index.php?app=downloads&showfile=' + row.fileId,
						type: 'table',
						engine: 'vpf',
						reference: row.id,
						postAction: JSON.stringify({
							dlrom: params.dlrom ? true : false,
							dlmedia: params.dlmedia ? true : false,
							dlvideo:  params.dlvideo ? true : false,
							addtohp:  params.addtohp ? true : false
						})
					}, function(err, msg) {
						if (err) {
							return callback(error.api(err));
						}
						callback(msg);
					});
				} else {
					callback('Cannot find VPF file with ID "' + params.id + '".');
				}
			});

		}
	};
};

exports.api = new TransferApi();