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
						p.order = 'lastUpdate DESC';
				}
			} else {
				p.order = 'lastUpdate DESC';
			}
			schema.VpfFile.all(p).success(function(rows) {

				if (search) {
					// needs to have fuzzyExtract in the model!
					return schema.VpfFile.fuzzySearch(rows, params, callback);
				}

				var returnedRows = [];
				_.each(rows, function(row) {
					returnedRows.push(row.enhance());
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

exports.api = new VPForumsAPI();