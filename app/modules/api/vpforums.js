var error = require('./../error');

var schema = require('../../model/schema');

module.exports = function(app) {
	return exports;
};

var VPForumsAPI = function() {
	return {
		name : 'VPForums',

		FindTables : function(req, params, callback) {
			schema.CacheVpfDownload.all({ limit: 6, order: 'lastUpdate DESC' }).success(function(rows) {
				callback({ rows: rows.slice(0, 6), num: rows.length });
			});
		}
	};
};

exports.api = new VPForumsAPI();