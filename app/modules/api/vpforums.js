var error = require('./../error');

var schema = require('../../model/schema');

module.exports = function(app) {
	return exports;
};

var VPForumsAPI = function() {
	return {
		name : 'VPForums',

		FindTables : function(req, params, callback) {
			schema.CacheVpfDownload.all({ limit: 3 }).success(function(rows) {
				callback({ rows: rows.slice(0, 3), num: rows.length });
			});
		}
	};
};

exports.api = new VPForumsAPI();