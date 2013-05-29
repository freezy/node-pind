var _ = require('underscore');
var util = require('util');
var fuzzy = require('fuzzy');

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
			var search = params.search && params.search.length > 1;
			var p = {};
			var fields = function(row) {
				var r = {};
                var fieldsProvided = _.isArray(params.fields);
                if (fieldsProvided) {
					for (var field in row) {
						if (row.hasOwnProperty(field) && _.contains(params.fields, field)) {
							r[field] = row[field];
						}
					}
				} else {
					r = JSON.parse(JSON.stringify(row));
				}
				if (!fieldsProvided) {
					return r;
				}
				// additional attributes
				if (params.fields.indexOf('url_logo') > -1) {
					r.url_logo = pathTo.asset_logo(row.key);
				}
				if (params.fields.indexOf('url_square_small') > -1) {
					r.url_square_small = pathTo.asset_square_small(row.key);
				}
				if (params.fields.indexOf('url_square_medium') > -1) {
					r.url_square_medium = pathTo.asset_square_medium(row.key);
				}
				if (params.fields.indexOf('url_widescreen_small') > -1) {
					r.url_widescreen_small = pathTo.asset_widescreen_small(row.key);
				}
				if (params.fields.indexOf('url_widescreen_medium') > -1) {
					r.url_widescreen_medium = pathTo.asset_widescreen_medium(row.key);
				}
				if (params.fields.indexOf('url_banner') > -1) {
					r.url_banner = pathTo.asset_banner(row.key);
				}
				if (params.fields.indexOf('url_banner_small') > -1) {
					r.url_banner_small = pathTo.asset_banner_small(row.key);
				}
				if (params.fields.indexOf('url_portrait_small') > -1) {
					r.url_portrait_small = pathTo.asset_portrait_small(row.key);
				}
				if (params.fields.indexOf('url_portrait_medium') > -1) {
					r.url_portrait_medium = pathTo.asset_portrait_medium(row.key);
				}
				if (params.fields.indexOf('url_backglass_small') > -1) {
					r.url_backglass_small = pathTo.asset_backglass_small(row.key);
				}
				if (params.fields.indexOf('url_backglass_medium') > -1) {
					r.url_backglass_medium = pathTo.asset_backglass_medium(row.key);
				}
				return r;
			};
			if (!search) {
				p = {
					offset: params.offset ? parseInt(params.offset) : 0,
					limit: params.limit ? parseInt(params.limit) : 0
				};
			}
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
						case 'hiscoreAny':
							p.where = '(`id` IN (SELECT DISTINCT `tableId` FROM `hiscores`)) OR ';
							break;

						case 'hiscoreUsers':
							p.where = '(`id` IN (SELECT DISTINCT `tableId` FROM `hiscores` WHERE `userId` IS NOT NULL)) OR ';
							break;

						case 'hiscoreUser':
							p.where = '(`id` IN (SELECT DISTINCT `tableId` FROM `hiscores` WHERE `userId` = ' + req.session.user.id + ')) OR ';
							break;
					}
				}

				// trim trailing operator
				if (p.where && p.where.length > 0) {
					p.where = p.where.substr(0, p.where.lastIndexOf(')') + 1);
					console.log('Condition: WHERE %s', p.where);
				} else {
					delete p.where;
				}
				switch (params.search) {
					case 'latest':
						p.order = 'createdAt DESC';
						break;
					default:
						p.order = 'name ASC';
				}
			}
			schema.Table.all(p).success(function(rows) {

				if (search) {
					// needs to have fuzzyExtract in the model!
					return schema.Table.fuzzySearch(rows, params, callback);
				}

				delete p.limit;
				delete p.offset;
				delete p.order;
				schema.Table.count(p).success(function(num) {

					// if fields are specified, strip non-specificed fields.
					if (params.fields && params.fields instanceof Array) {
						console.log('stripping fields..');
						var rs = [];
						for (var i = 0; i < rows.length; i++) {
							rs.push(fields(rows[i]));
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