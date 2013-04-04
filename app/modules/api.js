var fs = require('fs');
var exec = require('child_process').exec;
var express = require('express');

var schema = require('../model/schema');
var njrpc = require('./njrpc');

var hp, vp;

module.exports = function(app) {
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
			console.log('Getting all tables: %j', params);
			var p = {
				order: params.order ? params.order.replace(/[^\w\s]*/g, '') : 'name ASC',
				offset: params.offset ? parseInt(params.offset) : 0,
				limit: params.limit ? parseInt(params.limit) : 0
			};
			if (params.filters && Array.isArray(params.filters)) {
				for (var i = 0; i < params.filters.length; i++) {
					var filter = params.filters[i];
					switch (filter) {
						case 'table':
							break;
						case 'rom':
							p.where = { rom_file: false };
							break;
						case 'ipdb':
							break;
						case 'media':
							p.where = { rom_file: false };
							break;
					}
				}
			}
			schema.Table.findAll(p).success(function(rows) {

				delete p.limit;
				delete p.skip;
				delete p.order;
				schema.Table.count(p).success(function(num) {

					console.log('Returning ' + rows.length + ' rows from a total of ' + num + '.');
					callback({ rows : rows, count: num });

				}).error(function(err) {
						throw new Error(err);
				});
			}).error(function(err) {
				throw Error(err);
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
						TableApi().GetAll(req, params, callback);
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