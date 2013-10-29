'use strict';

var _ = require('underscore');
var fs = require('fs');
var ent = require('ent');
var util = require('util');
var fuzzy = require('fuzzy');
var logger = require('winston');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');
var error = require('../modules/error');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce').registerSocketStream(ss);

	return {

		one: function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());

			schema.Table.find({ where : { key : params.id }}).success(function(row) {
				if (row) {
					details(fields(row, params), res);
				} else {
					res(error.api('Cannot find table with ID "' + params.id + '".'));
				}
			});
		},

		all: function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());

			var hasFilter = function(filter) {
				return params.filters && Array.isArray(params.filters) && _.contains(params.filters, filter);
			};

			var search = params.search && params.search.length > 1;
			var p = {};

			if (!search) {
				p = {
					offset : params.offset ? parseInt(params.offset) : 0,
					limit : params.limit ? parseInt(params.limit) : 0
				};
			}
			if (params.filters && Array.isArray(params.filters)) {
				for (var i = 0; i < params.filters.length; i++) {
					if (i == 0) {
						var filterWhere = '';
					}
					var filter = params.filters[i];
					switch (filter) {
						case 'table':
							filterWhere += '(NOT `table_file`) OR ';
							break;
						case 'rom':
							filterWhere += '(NOT `rom_file` AND rom IS NOT NULL) OR ';
							break;
						case 'ipdb':
							filterWhere += '(`ipdb_no` IS NULL AND `type` <> "OG") OR ';
							break;
						case 'media':
							if (settings.pind.ignoreTableVids) {
								filterWhere += '(NOT `media_table` OR NOT `media_backglass` OR NOT `media_wheel`) OR ';
							} else {
								filterWhere += '(NOT `media_table` OR NOT `media_backglass` OR NOT `media_wheel` OR NOT `media_video`) OR ';
							}
							break;
						case 'hiscoreAny':
							filterWhere = '(`id` IN (SELECT DISTINCT `tableId` FROM `hiscores`)) OR ';
							break;

						case 'hiscoreUsers':
							filterWhere = '(`id` IN (SELECT DISTINCT `tableId` FROM `hiscores` WHERE `userId` IS NOT NULL)) OR ';
							break;

						case 'hiscoreUser':
							filterWhere = '(`id` IN (SELECT DISTINCT `tableId` FROM `hiscores` WHERE `userId` = ' + req.session.user.id + ')) OR ';
							break;
					}
				}

				/**
				 * order tables by latest hiscore:
				 *
				 *        SELECT t.*, h.lastHiscoreAt
				 *        FROM tables t
				 *        JOIN (SELECT tableId, MAX(updatedAt) AS lastHiscoreAt FROM hiscores GROUP BY tableId) h ON (h.tableId = t.id)
				 *        ORDER BY lastHiscoreAt DESC
				 */

				// trim trailing operator
				if (filterWhere && filterWhere.length > 0) {
					filterWhere = filterWhere.substr(0, filterWhere.lastIndexOf(')') + 1);
				}
			}

			if (hasFilter('enabledOnly')) {
				p.where = '`hpenabled`' + (filterWhere ? ' AND ' + filterWhere : '');
			} else {
				p.where = filterWhere ? filterWhere : undefined;
			}
			//console.log('Condition: WHERE %s', p.where);

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
					return schema.Table.fuzzySearch(rows, params, res);
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

					logger.log('info', '[db] [table] Returning %d rows from a total of %d.', rows.length, num );
					res({ rows : rows, count : num });
				});

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
	};

	var htmlEncode = function(attr) {
		if (r[attr]) {
			r[attr] = ent.encode(r[attr]);
		}
	};
	htmlEncode('features');
	htmlEncode('notes');
	htmlEncode('toys');
	var asset = '/asset';

	// urls attributes
	if (hasField('url')) {
		r.url = '/table/' + row.key;
	}
	if (hasField('url_logo')) {
		r.url_logo = asset + '/logo/' + row.key + '.png';
	}
	if (hasField('url_square_small')) {
		r.url_square_small = asset + '/square/' + row.key + '.small.png';
	}
	if (hasField('url_square_medium')) {
		r.url_square_medium = asset + '/square/' + row.key + '.medium.png';
	}
	if (hasField('url_widescreen_small')) {
		r.url_widescreen_small = asset + '/widescreen/' + row.key + '.small.png';
	}
	if (hasField('url_widescreen_medium')) {
		r.url_widescreen_medium = asset + '/widescreen/' + row.key + '.medium.png';
	}
	if (hasField('url_banner')) {
		r.url_banner = asset + '/banner/' + row.key + '.png';
	}
	if (hasField('url_banner_small')) {
		r.url_banner_small = asset + '/banner/' + row.key + '.small.png';
	}
	if (hasField('url_portrait_small')) {
		r.url_portrait_small = asset + '/portrait/' + row.key + '.small.png';
	}
	if (hasField('url_portrait_medium')) {
		r.url_portrait_medium = asset + '/portrait/' + row.key + '.medium.png';
	}
	if (hasField('url_backglass_small')) {
		r.url_backglass_small = asset + '/backglass/' + row.key + '.small.png';
	}
	if (hasField('url_backglass_medium')) {
		r.url_backglass_medium = asset + '/backglass/' + row.key + '.medium.png';
	}

	return r;
}

function details(r, callback) {

	var asset = '/asset';
	var prefix = settings.hyperpin.path + '/Media/HyperPin';

	if (fs.existsSync(prefix + '/Flyer Images/Front/' + r.hpid + '.jpg')) {
		r.url_flyer_front_medium = asset + '/flyer_front/' + r.key + '.medium.png';
	}
	if (fs.existsSync(prefix + '/Flyer Images/Back/' + r.hpid + '.jpg')) {
		r.url_flyer_back_medium = asset + '/flyer_back/' + r.key + '.medium.png';
	}

	if (r.rom) {
		schema.Rom.find({ where : { name : r.rom }}).success(function(rom) {
			if (rom) {
				r.audits = rom;
				if (rom.scoreHistogram) {
					r.audits.scoreHistogram = JSON.parse(rom.scoreHistogram);
				}
				if (rom.playtimeHistogram) {
					r.audits.playtimeHistogram = JSON.parse(rom.playtimeHistogram);
				}
			}
			callback(r);
		});
	} else {
		callback(r);
	}
}
