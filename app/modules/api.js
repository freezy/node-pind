var fs = require('fs');
var express = require('express');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');
var njrpc = require('./njrpc');

var hp, vp, ipdb;

module.exports = function(app) {
	hp = require('./hyperpin')(app);
	vp = require('./visualpinball')(app);
	ipdb = require('./ipdb')(app);
	return exports;
}

function error(message, code, data) {
	var error = { error: { message: message } };
	if (code) {
		error.code = code;
	}
	if (data) {
		error.data = data;
	}
	return error;
};

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
				console.log('inserting coin into slot ' + slot + '...');
				hp.insertCoin(req.session.user, slot, function(err, result) {
					if (err) {
						console.log(err);
						throw new Error(err);
					} else {
						callback(result);
					}
				});

			} else {
				callback(error('Parameter "slot" is missing.'));
			}
		}
	};
}

var TableApi = function() {
	return {
		name : 'Table',

		GetAll : function(req, params, callback) {
			var p = {
				order: params.order ? params.order.replace(/[^\w\s]*/g, '') : 'name ASC',
				offset: params.offset ? parseInt(params.offset) : 0,
				limit: params.limit ? parseInt(params.limit) : 0
			};
			if (params.filters && Array.isArray(params.filters)) {
				console.log('Filters: %j', params.filters);
				for (var i = 0; i < params.filters.length; i++) {
					if (i == 0) {
						p.where = '';
					}
					var filter = params.filters[i];
					switch (filter) {
						case 'table':
							p.where += '(NOT `table_file`) OR ';
							break;
						case 'rom':
							p.where += '(NOT `rom_file` AND rom IS NOT NULL) OR ';
							break;
						case 'ipdb':
							p.where += '(`ipdb_no` IS NULL AND `type` <> "OG") OR ';
							break;
						case 'media':
							if (settings.pind.ignoreTableVids) {
								p.where += '(NOT `media_table` OR NOT `media_backglass` OR NOT `media_wheel`) OR ';
							} else {
								p.where += '(NOT `media_table` OR NOT `media_backglass` OR NOT `media_wheel` OR NOT `media_video`) OR ';
							}
							break;
					}

				}
				if (p.where) {
					p.where = p.where.substr(0, p.where.length - 4);
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

var UserApi = function() {
	return {
		name : 'User',

		GetAll : function(req, params, callback) {
			var p = {
				order: params && params.order ? params.order.replace(/[^\w\s]*/g, '') : 'name ASC',
				offset: params && params.offset ? parseInt(params.offset) : 0,
				limit: params && params.limit ? parseInt(params.limit) : 0
			};
			if (params.filters && Array.isArray(params.filters)) {
				for (var i = 0; i < params.filters.length; i++) {
					if (i == 0) {
						p.where = '';
					}
					var filter = params.filters[i];
					switch (filter) {
						case 'nocredits':
							p.where += '(`credits` = 0) OR ';
							break;
					}
				}
				if (p.where) {
					p.where = p.where.substr(0, p.where.length - 4);
				}
			}

			schema.User.findAll(p).success(function(rows) {

				delete p.limit;
				delete p.skip;
				delete p.order;
				schema.User.count(p).success(function(num) {

					console.log('Returning ' + rows.length + ' rows from a total of ' + num + '.');
					callback({ rows : rows, count: num });

				}).error(function(err) {
					throw Error(err);
				});

			}).error(function(err) {
				throw Error(err);
			});
		},

		Update : function(req, params, callback) {
			var allowedFields = [ 'id', 'credits' ];
			if (!params.id) {
				return callback(error('ID must be set when updating user.'));
			}
			for (var field in params) {
				if (allowedFields.indexOf(field) == -1) {
					return callback(error('Illegal field "' + field + '".'));
				}
			}
			schema.User.find({ where: { id: params.id } }).success(function(user) {
				if (!user) {
					return callback(error('No user found with ID "' + params.id + '".'));
				}
				user.updateAttributes(params).success(function(user) {
					callback(user);
				}).error(function(err) {
					throw Error(err);
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
		},

		FetchIPDB : function(req, params, callback) {
			ipdb.syncIPDB(function(err, tables) {
				if (err) {
					throw new Error(err);
				}
				TableApi().GetAll(req, params, callback);
			});
		}
	};
}

njrpc.register([ new ControlApi(), new TableApi(), new HyperPinApi(), new UserApi() ]);

exports.handle = function(req, res) {
	njrpc.handle(req, res);
}