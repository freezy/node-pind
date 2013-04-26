var error = require('./../error');

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
					socket.emit('notice', { msg: 'ERROR: ' + err, type: 'error', timeout: 60000 });
					callback(error.api(err));
				} else {
					tableApi.GetAll(req, params, callback);
				}
			});
		},

		FindMissingMedia : function(req, params, callback) {
			hp.findMissingMedia(function(err) {
				if (err) {
					console.log("ERROR: " + err);
					socket.emit('notice', { msg: 'ERROR: ' + err, type: 'error', timeout: 60000 });
					callback(error.api(err));
				} else {
					tableApi.GetAll(req, params, callback);
				}
			})
		}
	};
};

exports.api = new HyperPinAPI();