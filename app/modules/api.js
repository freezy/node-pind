var fs = require('fs');
var exec = require('child_process').exec;
var express = require('express');

var am = require('./account-manager');
var tm = require('./table-manager');
var njrpc = require('./njrpc');

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
				var binPath = fs.realpathSync(__dirname + '../../../../bin');
				exec(binPath + '/Keysender.exe', function (error, stdout, stderr) {
					if (error !== null) {
						console.log(error);
					} else {
						callback({
							message : 'Coin inserted successfully! - ' + stdout,
							balance : req.user.credits
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
			tm.findAll(function(err, rows) {
				if (err) {
					throw new Error(err);
				}
				console.log("Got " + rows.length + " rows.");
				callback({ rows : rows });
			});
		}
	};
}


var preHandler = function(jsonReq, next) {
	return next();
}

njrpc.register([ new ControlApi(), new TableApi() ]);
njrpc.interceptor = preHandler;

exports.checkCredentials = express.basicAuth(function(user, pass, next) {
	am.manualLogin(user, pass, next);
});

exports.handle = function(req, res) {
	njrpc.handle(req, res);
}