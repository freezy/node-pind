var schema = require('../../model/schema');
var settings = require('../../../config/settings-mine');

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
			schema.Table.all(p).success(function(rows) {

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
};

exports.api = new TableApi();