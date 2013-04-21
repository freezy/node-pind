var hp = require('./../hyperpin');
var vp = require('./../visualpinball');
var ipdb = require('./../ipdb');

var tableApi;

module.exports = function(app) {
	tableApi = require('./table')(app).api;
	return exports;
};

var HyperPinAPI = function() {
	return {
		name : 'HyperPin',

		Sync : function(req, params, callback) {
			hp.syncTables(function(err) {
				if (err) {
					console.log("ERROR: " + err);
					throw new Error(err);
				} else {
					vp.updateTableData(function(err, tables) {
						if (err) {
							throw new Error(err);
						}
						tableApi.GetAll(req, params, callback);
					});
				}
			});
		}

	};
};

exports.api = new HyperPinAPI();