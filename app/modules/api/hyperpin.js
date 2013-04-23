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
			hp.syncTables(function(err) {
				if (err) {
					console.log("ERROR: " + err);
					throw new Error(err);
				} else {
					socket.emit('notice', { msg: 'Done syncing, starting analysis...' });

					vp.updateTableData(function(err, tables) {
						if (err) {
							throw new Error(err);
						}
						socket.emit('notice', { msg: 'Finished analyzing tables.', timeout: 5000 });
						tableApi.GetAll(req, params, callback);
					});
				}
			});
		}

	};
};

exports.api = new HyperPinAPI();