var schema = require('../../model/schema');
var settings = require('../../../config/settings-mine');

var pathTo;

module.exports = function(app) {
	pathTo = app.compound.map.pathTo;
	return exports;
};

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
						case 'hiscore':
							p.where += '(`id` IN (SELECT DISTINCT `tableId` FROM `hiscores`)) OR ';
							break;
					}
				}
				// trim trailing operator
				if (p.where) {
					p.where = p.where.substr(0, p.where.lastIndexOf(')') + 1);
				}

				// add search condition
				if (params.search && params.search.length > 1) {
					var where = 'LOWER(`name`) LIKE "%' + params.search + '%"';
					if (p.where) {
						where = '(' + p.where + ') AND (' + where + ')';
					}
					p.where = where;
				}

				if (p.where) {
					console.log('Condition: WHERE %s', p.where);
				}

			}
			schema.Table.all(p).success(function(rows) {

				delete p.limit;
				delete p.skip;
				delete p.order;
				schema.Table.count(p).success(function(num) {

					// if fields are specified, strip non-specificed fields.
					if (params.fields && params.fields instanceof Array) {
						console.log('stripping fields..');
						var rs = [];
						for (var i = 0; i < rows.length; i++) {
							var r = {};
							for (var field in rows[i]) {
								if (params.fields.indexOf(field) > -1) {
									r[field] = rows[i][field];
								}
							}
							// additional attributes
							if (params.fields.indexOf('url_logo') > -1) {
								r.url_logo = pathTo.asset_logo(rows[i].key);
							}
							if (params.fields.indexOf('url_banner') > -1) {
								r.url_banner = pathTo.asset_banner(rows[i].key);
							}
							if (params.fields.indexOf('url_portrait_small') > -1) {
								r.url_portrait_small = pathTo.asset_portrait_small(rows[i].key);
							}
							if (params.fields.indexOf('url_backglass_small') > -1) {
								r.url_backglass_small = pathTo.asset_backglass_small(rows[i].key);
							}
							rs.push(r);
						}
						rows = rs;
					}
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