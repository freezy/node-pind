var _ = require('underscore');

var error = require('../modules/error');
var schema = require('../database/schema');
var vpf = require('../modules/vpforums');

exports.actions = function(req, res, ss) {
	req.use('session');

	return {

		createIndex : function() {
			vpf.cacheAllTableDownloads(function(err) {
				if (err) {
					console.log("ERROR: " + err);
				}
			});
			res('Index creation started. Status updates via socket.');
		},

		updateIndex : function() {
			vpf.cacheLatestTableDownloads(function(err) {
				if (err) {
					console.log("ERROR: " + err);
				}
			});
			res('Index update started. Status updates via socket.');
		},

		tables : function(params) {
			var category = 41;
			var search = params.search && params.search.length > 1;
			var p = { where: { category: category }};

			// pagination
			if (!search) {
				p.offset = params.offset ? parseInt(params.offset) : 0;
				p.limit = params.limit ? parseInt(params.limit) : 0;
			}
			// sort
			if (params.order) {
				switch(params.order) {
					case 'downloads':
						p.order = 'downloads DESC';
						break;
					case 'views':
						p.order = 'views DESC';
						break;
					case 'latest':
					default:
						p.order = 'lastUpdatedAt DESC';
				}
			} else {
				p.order = 'lastUpdatedAt DESC';
			}
			var query =
				'SELECT f.*, t.startedAt, t.failedAt, t.completedAt, t.createdAt AS queuedAt, t.id as transferId FROM vpf_files f ' +
				'LEFT JOIN transfers t ON t.reference = f.id ' +
				'WHERE category = ' + category + ' ' +
				'ORDER BY f.' + p.order;
			if (!search) {
				query += ' LIMIT ' + p.limit + ' OFFSET ' + p.offset;
			}
			var queryStart = +new Date();
			schema.sequelize.query(query).success(function(rows) {

				var queryTime = (+new Date() - queryStart);
				if (search) {
					console.log('Fetched ' + rows.length + ' rows in ' + queryTime + 'ms for fuzzy search.');
					// needs to have fuzzyExtract in the model!
					return schema.VpfFile.fuzzySearch(rows, params, res);
				}

				var returnedRows = [];
				_.each(rows, function(row) {
					returnedRows.push(schema.VpfFile.map(row));
				});

				delete p.limit;
				delete p.offset;
				delete p.order;
				var countStart = +new Date();
				schema.VpfFile.count(p).success(function(num) {
					var countTime = (+new Date() - countStart);

					console.log('Returning ' + rows.length + ' rows from a total of ' + num + ' (%d/%dms).', queryTime, countTime);
					res({ rows: returnedRows, count: num, queryTime: queryTime, countTime: countTime });

				}).error(function(err) {
					throw new Error(err);
				});
			});
		}
	};
};