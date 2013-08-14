'use strict';

var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var error = require('../modules/error');
var transfer = require('../modules/transfer');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce').registerSocketStream(ss);

	return {

		control: function(params) {
			transfer.control(params.action, function(err) {
				if (err) {
					logger.log('error', '[rpc] [transfer] [control] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			})
		},

		reorder: function(params) {
			if (!params.id) {
				return res(error.api('Missing parameter: "id".'));
			}
			if (!params.between.prev && !params.between.next) {
				return res(error.api('Must specify at least previous or next item.'));
			}
			transfer.reorder(params.id, params.between.prev, params.between.next, function(err) {
				if (err) {
					logger.log('error', '[rpc] [transfer] [reorder] %s', err);
					res(error.api(err));
				} else {
					res({ msg: 'Transfer with ID "' + params.id + '" removed.'});
				}
			});
		},

		remove: function(params) {
			transfer.delete(params.id, function(err) {
				if (err) {
					logger.log('error', '[rpc] [transfer] [delete] %s', err);
					res(error.api(err));
				} else {
					res({ msg: 'Transfer with ID "' + params.id + '" removed.'});
				}
			});
		},

		resetFailed: function() {
			transfer.resetFailed(function(err) {
				if (err) {
					logger.log('error', '[rpc] [transfer] [reset failed] %s', err);
					res(error.api(err));
				} else {
					res({ success: true });
				}
			})
		},

		addvpt: function(params) {
			schema.VpfFile.find(params.id).success(function(row) {
				if (row) {
					row = row.map();
					transfer.queue({
						title: row.title,
						url: row.url,
						type: 'table',
						engine: 'vpf',
						reference: row.id,
						postAction: JSON.stringify({
							dlrom: params.dlrom ? true : false,
							dlmedia: params.dlmedia ? true : false,
							dlvideo:  params.dlvideo ? true : false,
							addtohp:  params.addtohp ? true : false
						})
					}, function(err, msg) {
						if (err) {
							logger.log('error', '[rpc] [transfer] [add vpt] %s', err);
							res(error.api(err));
						} else {
							res(msg);
						}
					});
				} else {
					res('Cannot find VPF file with ID "' + params.id + '".');
				}
			});
		},


		all: function(params) {

			params = params || {};
			var search = params.search && params.search.length > 1;

			// this sucks ass but can't be avoided (mysql wants parentheses, sqlite doesn't.)
			var p1 = settings.pind.database.engine == 'sqlite' ? '' : '(';
			var p2 = settings.pind.database.engine == 'sqlite' ? '' : ')';

			var query = p1
				// failed
				+ 'SELECT *, 1 AS s, failedAt as sAsc, 1 as sDesc FROM transfers WHERE failedAt IS NOT NULL'
				+ p2 + ' UNION ' + p1
				// transferring
				+ 'SELECT *, 2 AS s, startedAt as sAsc, 1 as sDesc FROM transfers WHERE startedAt IS NOT NULL AND completedAt IS NULL AND failedAt IS NULL'
				+ p2 + ' UNION ' + p1
				// queued
				+ 'SELECT *, 3 AS s, sort as sAsc, 1 as sDesc FROM transfers WHERE startedAt IS NULL AND completedAt IS NULL AND failedAt IS NULL'
				+ p2 + ' UNION ' + p1
				// completed
				+ 'SELECT *, 4 AS s, 1 as sAsc, completedAt as sDesc FROM transfers WHERE completedAt IS NOT NULL'
				+ p2 + ' ORDER BY s ASC, sAsc ASC, sDesc DESC';

			// pagination
			if (!search) {
				query += ' LIMIT ' + (params.limit ? parseInt(params.limit) : 0);
				query += ' OFFSET ' + (params.offset ? parseInt(params.offset) : 0);
			}

			schema.sequelize.query(query, null, { raw: true, type: 'SELECT' }).success(function(rows) {
				//schema.Transfer.all(p).success(function(rows) {

				if (search) {
					// needs to have fuzzyExtract in the model!
					return schema.VpfFile.fuzzySearch(rows, params, res);
				}

				var returnedRows = [];
				var currentProgress = transfer.getCurrentProgress();
				_.each(rows, function(row) {
					returnedRows.push(schema.Transfer.map(row, currentProgress[row.id]));
				});

				schema.Transfer.count().success(function(num) {

					logger.log('info', '[db] [transfer] Returning ' + returnedRows.length + ' rows from a total of ' + num + '.');
					res({ rows: returnedRows, count: num });

				}).error(function(err) {
						throw new Error(err);
					});
			});
		}
	};
};
