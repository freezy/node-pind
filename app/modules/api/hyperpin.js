var hp, vp, ipdb, tableApi, socket;

module.exports = function(app) {
	hp = require('./../hyperpin')(app);
	vp = require('./../visualpinball')(app);
	ipdb = require('./../ipdb')(app);
	socket = app.get('socket.io');
	tableApi = require('./table')(app).api;
	return exports;
};

var HyperPinAPI = function() {
	return {
		name : 'HyperPin',

		Sync : function(req, params, callback) {
			hp.syncTablesWithData(function(err) {
				if (err) {
					console.log("ERROR: " + err);
					throw new Error(err);
				} else {
					tableApi.GetAll(req, params, callback);
				}
			});
		}
	};
};

exports.api = new HyperPinAPI();