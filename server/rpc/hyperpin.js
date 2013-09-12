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
			var p = { order: 'name' };
			var queryStart = +new Date();
			schema.Table.all(p).success(function(rows) {
				var queryTime = (+new Date() - queryStart);

				var hasFilter = function(filter) {
					return params.filters && Array.isArray(params.filters) && _.contains(params.filters, filter);
				};

				if (hasFilter('confirmed')) {
					rows = _.filter(rows, function(row) {
						return true;
					});
				} else {
					rows = _.filter(rows, function(row) {
						return true;
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
				var m;
				_.each(pagedRows, function(row) {
					m = row.hpid.match(/([^\(]+)\s+\(([^\)]+)\s+(\d{4})\s*\)/); // match Medieval Madness (Williams 1997)
					if (m) {
						row.hp_name = m[1];
						row.hp_manufacturer = m[2];
						row.hp_year = m[3];
					}
					returnedRows.push(row);
				});

				res({ rows: returnedRows, count: rows.length, queryTime: queryTime });
			});
		}

	};
};
