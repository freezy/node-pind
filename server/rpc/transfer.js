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
		reorder: function(params) {
			if (!params.id) {
				return res(error.api('Missing parameter: "id".'));
			}
			if (!params.between.prev && !params.between.next) {
				return res(error.api('Must specify at least previous or next item.'));
			}
			schema.Transfer.find(params.id).success(function(row) {
				if (!row) {
					return res(error.api('No transfer found with ID "' + params.id + '".'));
				}
				var ids = _.reject(_.values(params.between), function(num) {
					return num == 0;
				});
				console.log('Reorder: %j', params);

				schema.Transfer.all({ where: { id: ids }}).success(function(rows) {
					var prev, next;

					// item has been dropped between 2 rows: easy
					if (params.between.prev && params.between.next) {
						if (rows.length != 2) {
							return res(error.api('One of ' + ids + ' is not in database.'));
						}
						prev = rows[0].id == params.between.prev ? rows[0] : rows[1];
						next = rows[1].id == params.between.next ? rows[1] : rows[0];
						row.updateAttributes({
							sort: Math.round((prev.sort + next.sort) / 2)
						});
					}
					// item has been dropped on top of the list (could be page 2+ though)
					if (!params.between.prev && params.between.next) {
						next = rows[0];
						// find prev item
						schema.Transfer.find({ where: [ 'sort < ?', next.sort], limit: 1 }).success(function(prev) {
							var prevSort = prev ? prev.sort : next.sort - 1024;
							row.updateAttributes({
								sort: Math.round((prevSort + next.sort) / 2)
							});
						});
					}

					// item has been dropped on bottom of the list (could be more items on next page)
					if (params.between.prev && !params.between.next) {
						prev = rows[0];
						// find prev item
						schema.Transfer.find({ where: [ 'sort > ?', prev.sort], limit: 1 }).success(function(next) {
							var nextSort = next ? next.sort : prev.sort + 1024;
							row.updateAttributes({
								sort: Math.round((prev.sort + nextSort) / 2)
							});
						});
					}
					res();
				});

			});
		},

		remove: function(params) {
			transfer.delete(params.id, function(err) {
				if (err) {
					return res(error.api(err));
				}
				res({ msg: 'Transfer with ID "' + params.id + '" removed.'});
			});
		},

		resetFailed: function() {
			transfer.resetFailed(function(err) {
				if (err) {
					return res(error.api(err));
				}
				res({ success: true });
			})
		},

		control: function(params) {
			var done = function(result) {
				transfer.getStatus(function(err, status) {
					res({ status: status });
				});
			};
			switch (params.action) {
				case 'start': {
					transfer.start();
					done();
					break;
				}
				case 'pause': {

					break;
				}
				case 'stop': {

					break;
				}
				default:
					res(error.api('Unknown action: "' + params.action + '".'));
			}
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

					console.log('Returning ' + returnedRows.length + ' rows from a total of ' + num + '.');
					res({ rows: returnedRows, count: num });

				}).error(function(err) {
						throw new Error(err);
					});
			});
		}
	};
};
