'use strict';

var _ = require('underscore');
var logger = require('winston');

var hp = require('../modules/hyperpin');
var error = require('../modules/error');
var schema = require('../database/schema');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce').registerSocketStream(ss);

	return {

		read: function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			hp.readTablesWithData(function(err) {
				if (err) {
					logger.log('error', '[rpc] [hyperpin] [sync] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		},

		findMissingMedia: function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			hp.findMissingMedia(function(err) {
				if (err) {
					logger.log('error', '[rpc] [hyperpin] [findMissingMedia]  %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		},

		setEnabled: function(key, val) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			hp.setEnabled(key, val, function(err) {
				if (err) {
					logger.log('error', '[rpc] [hyperpin] [setEnabled] %s', err);
				} else {
					res();
				}
			})
		},

		ipdbmatch: function(params) {

			var hasFilter = function(filter) {
				return params.filters && Array.isArray(params.filters) && _.contains(params.filters, filter);
			};


			var op = hasFilter('identical') ? '=' : '<>';

			var queryWhere;
			var queryWhat = 'SELECT * FROM tables ';
			var queryOrder= 'ORDER BY name ASC';

			if (hasFilter('nomatch')) {
				queryWhere = 'WHERE `ipdb_no` IS NULL ';
			} else {
				queryWhere = 'WHERE hpid ' + op + ' CONCAT(`name`, " (", `manufacturer`, " ", `year`, ")")';
			}


			var query = queryWhat + queryWhere + queryOrder;
			var queryStart = +new Date();
			schema.sequelize.query(query).success(function(rows) {
				var queryTime = (+new Date() - queryStart);

				var norm = function(str) {
					return str ? str.toString().replace(/[^a-z0-9\(\)]+/ig, '').toLowerCase() : str;
				};

				_.map(rows, function(row) {
					row.norm = {
						name: norm(row.name),
						manufacturer: norm(row.manufacturer),
						year: norm(row.year)
					}
				});

				if (hasFilter('identical')) {
					rows = _.filter(rows, function(row) {
						var hpidNorm = row.norm.name + '(' + row.norm.manufacturer + row.norm.year + ')';
						return hpidNorm == norm(row.hpid);
					});
				} else {
					rows = _.filter(rows, function(row) {
						var hpidNorm = row.norm.name + '(' + row.norm.manufacturer + row.norm.year + ')';
						return hpidNorm != norm(row.hpid);
					});
				}

				var pagedRows;
				var offset = params.offset ? parseInt(params.offset) : 0;
				var limit = params.limit ? parseInt(params.limit) : 0;
				if (offset || limit) {
					pagedRows = rows.slice(offset, offset + limit);
				} else {
					pagedRows = rows;
				}

				var returnedRows = [];
				var m, r;
				_.each(pagedRows, function(row) {
					r = row;
					m = row.hpid.match(/([^\(]+)\s+\(([^\)]+)\s+(\d{4})\s*\)/); // match Medieval Madness (Williams 1997)
					if (m) {
						r.hp = {
							name: m[1],
							manufacturer: m[2],
							year: m[3],
							norm: {
								name: norm(m[1]),
								manufacturer: norm(m[2]),
								year: norm(m[3]),
							}
						}
					}
					returnedRows.push(r);
				});

				res({ rows: returnedRows, count: rows.length, queryTime: queryTime });
			});
		}

	};
};
