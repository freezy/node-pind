var _ = require('underscore');
var util = require('util');
var fuzzy = require('fuzzy');

var error = require('../error');
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

		Get : function(req, params, callback) {
			schema.Table.find({ where: { key : params.id }}).success(function(row) {
				if (row) {
					callback(fields(row, params));
				} else {
					callback(error.api('Cannot find table with ID "' + params.id + '".'));
				}
			});
		},

		GetAll : function(req, params, callback) {
			var search = params.search && params.search.length > 1;
			var p = {};

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

				/**
				 * order tables by latest hiscore:
				 *
				 *		SELECT t.*, h.lastHiscoreAt
				 *		FROM tables t
				 *		JOIN (SELECT tableId, MAX(updatedAt) AS lastHiscoreAt FROM hiscores GROUP BY tableId) h ON (h.tableId = t.id)
				 *		ORDER BY lastHiscoreAt DESC
				 */

				// trim trailing operator
				if (p.where && p.where.length > 0) {
					p.where = p.where.substr(0, p.where.lastIndexOf(')') + 1);
					console.log('Condition: WHERE %s', p.where);
				} else {
					delete p.where;
				}
			}

			// sorting
			switch (params.sort) {
				case 'latest':
					p.order = 'createdAt DESC';
					break;
				default:
					p.order = 'name ASC';
					break;
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

					var rs = [];
					for (var i = 0; i < rows.length; i++) {
						rs.push(fields(rows[i], params));
					}
					rows = rs;
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

function fields(row, params) {
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
	var hasField = function(field) {
		return !fieldsProvided || params.fields.indexOf(field) > -1;
	}

	// additional attributes
	if (hasField('url')) {
		r.url = pathTo.table(row.key);
	}
	if (hasField('url_logo')) {
		r.url_logo = pathTo.asset_logo(row.key);
	}
	if (hasField('url_square_small')) {
		r.url_square_small = pathTo.asset_square_small(row.key);
	}
	if (hasField('url_square_medium')) {
		r.url_square_medium = pathTo.asset_square_medium(row.key);
	}
	if (hasField('url_widescreen_small')) {
		r.url_widescreen_small = pathTo.asset_widescreen_small(row.key);
	}
	if (hasField('url_widescreen_medium')) {
		r.url_widescreen_medium = pathTo.asset_widescreen_medium(row.key);
	}
	if (hasField('url_banner')) {
		r.url_banner = pathTo.asset_banner(row.key);
	}
	if (hasField('url_banner_small')) {
		r.url_banner_small = pathTo.asset_banner_small(row.key);
	}
	if (hasField('url_portrait_small')) {
		r.url_portrait_small = pathTo.asset_portrait_small(row.key);
	}
	if (hasField('url_portrait_medium')) {
		r.url_portrait_medium = pathTo.asset_portrait_medium(row.key);
	}
	if (hasField('url_backglass_small')) {
		r.url_backglass_small = pathTo.asset_backglass_small(row.key);
	}
	if (hasField('url_backglass_medium')) {
		r.url_backglass_medium = pathTo.asset_backglass_medium(row.key);
	}
	return r;
};

exports.api = new TableApi();