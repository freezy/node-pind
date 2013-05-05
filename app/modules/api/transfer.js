var util = require('util');

error = require('../error');
var schema = require('../../model/schema');


module.exports = function(app) {
	return exports;
};

var TransferApi = function() {
	return {
		name : 'Transfer',

		AddVPFTable : function(req, params, callback) {
			callback('yeah, sure.');
		}
	};
};

exports.api = new TransferApi();