var am = require('./account-manager');
var njrpc = require('./njrpc');
var express = require('express');

// API namespace "Control"
var Control = function() {
	return {
		name : 'Control',

		/**
		 * Inserts a coin into the pinball machine
		 * @param req Request object
		 * @param params Parameter object containing "slot".
		 */
		InsertCoin : function(req, params) {
			if ('slot' in params) {
				var slot = params.slot;
				return {
					message : 'Coin inserted successfully!',
					balance : req.user.credits
				};
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