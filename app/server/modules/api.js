var am = require('./account-manager');
var njrpc = require('./njrpc');
var express = require('express');
var sys = require('sys');
var exec = require('child_process').exec;

// API namespace "Control"
var Control = function() {
	return {
		name : 'Control',

		/**
		 * Inserts a coin into the pinball machine
		 * @param req Request object
		 * @param params Parameter object containing "slot".
		 */
		InsertCoin : function(req, params, callback) {
			if ('slot' in params) {
				var slot = params.slot;
				exec('D:/dev/node-pind/bin/Keysender.exe', function (error, stdout, stderr) {
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
var preHandler = function(jsonReq, next) {
	return next();
}

njrpc.register(new Control());
njrpc.interceptor = preHandler;

exports.checkCredentials = express.basicAuth(function(user, pass, next) {
	am.manualLogin(user, pass, next);
});

exports.handle = function(req, res) {
	njrpc.handle(req, res);
}