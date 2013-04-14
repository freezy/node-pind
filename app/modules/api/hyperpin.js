var hp = require('./../hyperpin');
var vp = require('./../visualpinball');
var ipdb = require('./../ipdb');
var tableApi = require('./table').api;

var HyperPinAPI = function() {
	return {
		name : 'HyperPin',

		Sync : function(req, params, callback) {
			hp.syncTables(function(err) {
				if (err) {
					console.log("ERROR: " + err);
					throw new Error(err);
				} else {
					vp.updateRomNames(function(err, tables) {
						if (err) {
							throw new Error(err);
						}
						tableApi.GetAll(req, params, callback);
					});
				}
			});
		},

		FetchIPDB : function(req, params, callback) {
			ipdb.syncIPDB(function(err, tables) {
				if (err) {
					throw new Error(err);
				}
				tableApi.GetAll(req, params, callback);
			});
		}
	};
};

exports.api = new HyperPinAPI();