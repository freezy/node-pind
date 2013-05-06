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
			var p = { where: {  }};

			// pagination
			if (!search) {
				p.offset = params.offset ? parseInt(params.offset) : 0;
				p.limit = params.limit ? parseInt(params.limit) : 0;
			}

			schema.Transfer.all(p).success(function(rows) {


/*				if (search) {
					console.log('Fuzzy-filtering ' + rows.length + ' rows...');
					var options = {
						pre: '<b>',
						post: '</b>',
						extract: function(el) { return el.title; }
					};
					var hits = fuzzy.filter(params.search, rows, options);
					console.log('Fuzzy-filtered ' + hits.length + ' hits.');

					// paging needs to be done manually
					var pagedResults;
					var offset = params.offset ? parseInt(params.offset) : 0;
					var limit = params.limit ? parseInt(params.limit) : 0;
					if (offset || limit) {
						pagedResults = hits.slice(offset, offset + limit);
					} else {
						pagedResults = hits;
					}

					// enhance and return
					var results = [];
					_.each(pagedResults, function(hit) {
						results.push(enhance(hit.original));
					});
					return callback({ rows : results, count: hits.length });
				}

*/
				var returnedRows = [];
				_.each(rows, function(row) {
//					returnedRows.push(enhance(row));
					returnedRows.push(row);
				});

				delete p.limit;
				delete p.offset;
				delete p.order;
				schema.VpfFile.count(p).success(function(num) {

					console.log('Returning ' + rows.length + ' rows from a total of ' + num + '.');
					callback({ rows: returnedRows, count: num });

				}).error(function(err) {
						throw new Error(err);
					});
			});
		}
	};
};

exports.api = new TransferApi();