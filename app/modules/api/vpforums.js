var _ = require('underscore');

var error = require('./../error');

var schema = require('../../model/schema');
var socket, vpf;

module.exports = function(app) {
	vpf = require('./../vpforums')(app);
	socket = app.get('socket.io');
	return exports;
};

var VPForumsAPI = function() {
	return {
		name : 'VPForums',

		CreateIndex : function(req, params, callback) {
			vpf.cacheAllTableDownloads(function(err) {
				if (err) {
					console.log("ERROR: " + err);
					socket.emit('notice', { msg: 'ERROR: ' + err, type: 'error', timeout: 60000 });

				} else {
					socket.emit('dataUpdated', { });
				}
			});
			callback('Index creation started. Status updates via socket.');
		},

		UpdateIndex : function(req, params, callback) {
			vpf.cacheLatestTableDownloads(function(err) {
				if (err) {
					console.log("ERROR: " + err);
					socket.emit('notice', { msg: 'ERROR: ' + err, type: 'error', timeout: 60000 });

				} else {
					socket.emit('dataUpdated', { });
				}
			});
			callback('Index update started. Status updates via socket.');
		},

		FindTables : function(req, params, callback) {
			
			var search = params.search && params.search.length > 1;
			var p = { where: { category: 41 }};

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
				'SELECT f.*, t.startedAt, t.failedAt, t.completedAt, t.createdAt AS queuedAt FROM vpf_files f ' +
				'LEFT JOIN transfers t ON t.reference = f.id ' +
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
					return schema.VpfFile.fuzzySearch(rows, params, callback);
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
					callback({ rows: returnedRows, count: num, queryTime: queryTime, countTime: countTime });

				}).error(function(err) {
					throw new Error(err);
				});
			});
		}
	};
};

exports.api = new VPForumsAPI();