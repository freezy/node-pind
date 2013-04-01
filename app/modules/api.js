var fs = require('fs');
var exec = require('child_process').exec;
var express = require('express');

var njrpc = require('./njrpc');

var hp, vp;
var Table;

module.exports = function(app) {
	Table = app.models.Table;
	hp = require('./hyperpin')(app);
	vp = require('./visualpinball')(app);
	return exports;
}

// API namespace "Control"
var ControlApi = function() {
	return {
		name : 'Control',

		/**
		 * Inserts a coin into the pinball machine.
		 *
 		 * @param req Request object
		 * @param params Parameter object containing "slot".
		 * @param callback
		 * @constructor
		 */
		InsertCoin : function(req, params, callback) {
			if ('slot' in params) {
				var slot = params.slot;
				var binPath = fs.realpathSync(__dirname + '../../../bin');
				exec(binPath + '/Keysender.exe', function (error, stdout, stderr) {
					if (error !== null) {
						console.log(error);
						throw new Error(error);
					} else {
						callback({
							message : 'Coin inserted successfully! - ' + stdout,
							balance : 10 //req.user.credits
						});
					}
				});
			} else {
				throw new Error('Parameter "slot" is missing.');
			}
		}
	};
}

var TableApi = function() {
	return {
		name : 'Table',

		GetAll : function(req, params, callback) {
			console.log('Getting all tables...');
			Table.all(function(err, rows) {
				if (err) {
					throw new Error(err);
				}
				console.log("Got " + rows.length + " rows.");
				callback({ rows : rows });
			});
		}
	};
}

var HyperPinApi = function() {
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
						Table.all(function(err, rows) {
							if (err) {
								throw new Error(err);
							}
							callback({ rows : rows });
						});
					});
				}
			});
		}
	};
}


var preHandler = function(jsonReq, next) {
	return next();
}

njrpc.register([ new ControlApi(), new TableApi(), new HyperPinApi() ]);
njrpc.interceptor = preHandler;

exports.checkCredentials = express.basicAuth(function(user, pass, next) {
	am.manualLogin(user, pass, next);
});

var auth = express.basicAuth(function(user, pass, callback) {
	var result = (user === 'testUser' && pass === 'testPass');
	callback(null /* error */, result);
});

exports.handle = function(req, res) {
	njrpc.handle(req, res);
}