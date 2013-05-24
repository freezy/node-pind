var util = require('util');
var _ = require('underscore');

error = require('../error');
var schema = require('../../model/schema');

var transfer;

module.exports = function(app) {
	transfer = require('./../transfer')(app);
	return exports;
};

var TransferApi = function() {
	return {
		name : 'Transfer',

		// {"id":"1","between":{"prev":"2","next":"3"}}}
		Reorder : function(req, params, callback) {
			if (!params.id) {
				return callback(error.api('Missing parameter: "id".'));
			}
			if (!params.between.prev && !params.between.next) {
				return callback(error.api('Must specify at least previous or next item.'));
			}
			schema.Transfer.find(params.id).success(function(row) {
				if (!row) {
					return callback(error.api('No transfer found with ID "' + params.id + '".'));
				}
				var ids = _.reject(_.values(params.between), function(num) {
					return num == 0;
				});
				console.log('Reorder: %j', params);

				schema.Transfer.all({ where: { id: ids }}).success(function(rows) {
					
					// item has been dropped between 2 rows: easy
					if (params.between.prev && params.between.next) {
						if (rows.length != 2) {
							return callback(error.api('One of ' + ids + ' is not in database.'));
						}
						var prev = rows[0].id == params.between.prev ? rows[0] : rows[1];
						var next = rows[1].id == params.between.next ? rows[1] : rows[0];
						console.log('PREV: %j', prev);
						console.log('NEXT: %j', next);
						console.log('NEW SORT: %d', Math.round((prev.sort + next.sort) / 2))
						row.updateAttributes({
							sort: Math.round((prev.sort + next.sort) / 2)
						});
					} 
					// item has been dropped on top of the list (could be page 2+ though)
					if (!params.between.prev && params.between.next) {
						var next = rows[0];
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
						var prev = rows[0];
						// find prev item
						schema.Transfer.find({ where: [ 'sort > ?', prev.sort], limit: 1 }).success(function(next) {
							var nextSort = next ? next.sort : prev.sort + 1024;
							row.updateAttributes({
								sort: Math.round((prev.sort + nextSort) / 2)
							});
						});
					}
					callback();
				});

			});
		},

		Delete : function(req, params, callback) {
			schema.Transfer.find(params.id).success(function(row) {
				if (row) {
					row.destroy().success(function() {
						callback({ msg: 'Transfer with ID "' + params.id + '" removed.'});
					});
				} else {
					callback(error.api('Cannot find VPF file with ID "' + params.id + '".'));
				}
			});
		},

		ResetFailed : function(req, params, callback) {
			transfer.resetFailed(function(err) {
				if (err) {
					return callback(error.api(err));
				}
				callback({success: true});
			})
		},

		Control : function(req, params, callback) {
			var done = function(result) {
				transfer.getStatus(function(err, status) {
					callback({ status: status });
				});
			}
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
					callback(error.api('Unknown action: "' + params.action + '".'));
			}
		},

		AddVPFTable : function(req, params, callback) {
			schema.VpfFile.find(params.id).success(function(row) {
				if (row) {
					transfer.queue({
						title: row.title,
						url: 'http://www.vpforums.org/index.php?app=downloads&showfile=' + row.fileId,
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
							return callback(error.api(err));
						}
						callback(msg);
					});
				} else {
					callback('Cannot find VPF file with ID "' + params.id + '".');
				}
			});
		},


		GetAll : function(req, params, callback) {

			var search = params.search && params.search.length > 1;

			var query = '('
				// failed
				+ 'SELECT *, 1 AS s, failedAt as sAsc, 1 as sDesc FROM transfers WHERE failedAt IS NOT NULL'
				+ ') UNION ('
				// transferring
				+ 'SELECT *, 2 AS s, startedAt as sAsc, 1 as sDesc FROM transfers WHERE startedAt IS NOT NULL AND completedAt IS NULL AND failedAt IS NULL'
				+ ') UNION ('
				// queued
				+ 'SELECT *, 3 AS s, sort as sAsc, 1 as sDesc FROM transfers WHERE startedAt IS NULL AND completedAt IS NULL AND failedAt IS NULL'
				+ ') UNION ('
				// completed
				+ 'SELECT *, 4 AS s, 1 as sAsc, completedAt as sDesc FROM transfers WHERE completedAt IS NOT NULL'
				+ ') ORDER BY s ASC, sAsc ASC, sDesc DESC'
			
			// pagination
			if (!search) {
				query += ' LIMIT ' + (params.limit ? parseInt(params.limit) : 0);
				query += ' OFFSET ' + (params.offset ? parseInt(params.offset) : 0);
			}

			schema.sequelize.query(query, null, { raw: true, type: 'SELECT' }).success(function(rows) {
			//schema.Transfer.all(p).success(function(rows) {

				if (search) {
					// needs to have fuzzyExtract in the model!
					return schema.VpfFile.fuzzySearch(rows, params, callback);
				}

				var returnedRows = [];
				_.each(rows, function(row) {
					returnedRows.push(schema.Transfer.map(row));
				});

				schema.Transfer.count().success(function(num) {

					console.log('Returning ' + returnedRows.length + ' rows from a total of ' + num + '.');
					callback({ rows: returnedRows, count: num });

				}).error(function(err) {
					throw new Error(err);
				});
			});
		}
	};
};

exports.api = new TransferApi();
