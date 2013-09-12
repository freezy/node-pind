'use strict';

var _ = require('underscore');
var fs = require('fs');

var logger = require('winston');
var vpf = require('../modules/vpforums');
var ipdb = require('../modules/ipdb');
var error = require('../modules/error');
var schema = require('../database/schema');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce').registerSocketStream(ss);

	return {

		createIndex : function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			vpf.cacheAllTableDownloads(function(err) {
				if (err) {
					logger.log('error', '[rpc] [vpf] [create index] %s', err);
					res(error.api(err));
				} else {
					res('Index creation started. Status updates via socket.');
				}
			});
		},

		updateIndex : function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			vpf.cacheLatestTableDownloads(function(err) {
				if (err) {
					logger.log('error', '[rpc] [vpf] [update index] %s', err);
					res(error.api(err));
				} else {
					res('Index update started. Status updates via socket.');
				}
			});
		},

		tables : function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());

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
				'LEFT JOIN transfers t ON t.ref_src = f.id ' +
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

					logger.log('info', '[rpc] [vpf] Returning ' + rows.length + ' rows from a total of ' + num + ' (%d/%dms).', queryTime, countTime);
					res({ rows: returnedRows, count: num, queryTime: queryTime, countTime: countTime });

				});
			});
		},

		ipdbmatch: function(params) {

			var category = 41;
			var p = { where: { category: category }, order: 'title' };
			var map = vpf.getIpdbMap();
			var queryStart = +new Date();
			schema.VpfFile.all(p).success(function(rows) {
				var queryTime = (+new Date() - queryStart);

				var hasFilter = function(filter) {
					return params.filters && Array.isArray(params.filters) && _.contains(params.filters, filter);
				};

				if (hasFilter('confirmed')) {
					rows = _.filter(rows, function(row) {
						return map[row.fileId] && map[row.fileId].confirmed;
					});
				} else {
					rows = _.filter(rows, function(row) {
						return !(map[row.fileId] && map[row.fileId].confirmed);
					});
				}

				if (hasFilter('original')) {
					rows = _.filter(rows, function(row) {
						return map[row.fileId] && map[row.fileId].type == 'OG';
					});
				} else {
					rows = _.filter(rows, function(row) {
						return !(map[row.fileId] && map[row.fileId].type == 'OG');
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
				var r;
				_.each(pagedRows, function(row) {
					r = schema.VpfFile.map(row);
					r.ipdb_data = map[row.fileId];
					returnedRows.push(r);
				});

				res({ rows: returnedRows, count: rows.length, queryTime: queryTime });
			});
		},

		ipdbmatchConfirm: function(id, what) {

			var mapFile = __dirname + '/../data/ipdb-vpf.json';
			var map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
			var done = function() {
				fs.writeFileSync(mapFile, JSON.stringify(map, null, 2));
				res();
			};

			schema.VpfFile.find(id).success(function(row) {
				if (!row) {
					logger.log('warn', '[rpc] [vpf] Cannot find VPF row ID %s.', id);
					return res()
				}

				var m, ipdb_id;
				var fileId = row.fileId;

				// check for ipdb url / id
				if (m = what.trim().match(/^http:\/\/.*?ipdb\.org.*?id=(\d+)/i)) {
					ipdb_id = m[1];
				}
				if (m = what.trim().match(/^\d+$/)) {
					ipdb_id = m[0];
				}

				if (ipdb_id) {
					ipdb.enrich({ ipdb_no: ipdb_id, name: row.title }, function(err, table) {
						if (err) {
							logger.log('error', err);
							return done();
						}
						if (!table.manufacturer) {
							logger.log('error', 'Unknown manufacturer: http://ipdb.org/search.pl?searchtype=advanced&mfgid=' + table.ipdb_mfg);
							return done();
						}
						map[fileId] = {
							ipdb: table.ipdb_no,
							title: table.name,
							year: table.year,
							manufacturer: table.manufacturer,
							img: table.img_playfield,
							title_original: row.title,
							title_original_trimmed: row.title_trimmed,
							confirmed: true
						};
						done();
					});
				} else {

					map[fileId].confirmed = true;

					// if no ipdb found, that means we're confirming an OG
					if (what == 'OG' || !map[fileId].ipdb) {
						delete map[fileId].ipdb;
						delete map[fileId].title;
						delete map[fileId].year;
						delete map[fileId].manufacturer;
						delete map[fileId].img;
						delete map[fileId].error;
						map[fileId].type = 'OG';
					}

					done();
				}

			});
		}
	};
};