'use strict';

var _ = require('underscore');
var util = require('util');
var async = require('async');
var logger = require('winston');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var au = require('../modules/autoupdate');
var hs = require('../modules/hiscore');
var hp = require('../modules/hyperpin');
var vpm = require('../modules/vpinmame');
var vpf = require('../modules/vpforums');
var ipdb = require('../modules/ipdb');
var nvram = require('../modules/nvram');
var error = require('../modules/error');
var transfer = require('../modules/transfer');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce').registerSocketStream(ss);
	return {

		status: function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());

			transfer.getStatus(function(err, transferStatus) {
				schema.Table.count().success(function(count) {
					schema.User.find({ where: { user: req.session.userId }}).success(function(user) {
						req.session.user = user;
						var status = {
							user: user,
							version: au.getVersion(),
							dataAvailable: count > 0,
							processing: {
								hpread: hp.isReading(),
								ipdbsync: ipdb.isSyncing(),
								dlrom: vpm.isFetchingRoms(),
								dlmedia: hp.isSearchingMedia(),
								fetchhs: hs.isFetching(),
								dlvpfindex: vpf.isDownloadingIndex(),
								crvpfindex: vpf.isCreatingIndex()
							},
							status: {
								transfer: transferStatus
							}
						};
						//console.log('STATUS = %s', util.inspect(req.session, false, 10, true));
						res(status);
					});

				});
			})

		},

		fetchIpdb : function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			ipdb.syncIPDB(function(err) {
				if (err) {
					logger.log('error', '[rpc] [pind] [fetch IPDB] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		},

		fetchMissingRoms : function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			vpm.fetchMissingRoms(function(err) {
				if (err) {
					logger.log('error', '[rpc] [pind] [fetch ROMs] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		},

		fetchHiscores : function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			hs.fetchHighscores(function(err) {
				if (err) {
					logger.log('error', '[rpc] [pind] [fetch hiscores] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		},

		fetchAudits : function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			nvram.readTables(function(err) {
				if (err) {
					logger.log('error', '[rpc] [pind] [fetch audits] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		},

		getHiscores : function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());

			var query =
				'SELECT h.*, t.key, u.user FROM hiscores h ' +
				'JOIN tables t ON t.id = h.tableId ' +
				'LEFT JOIN users u ON u.id = h.userId ';

			if (_.isArray(params.tableIds) && params.tableIds.length > 0) {
				_.map(params.tableIds, function(id) {
					return id.replace(/[^a-z\d]+/gi, '');
				});
				query += 'WHERE t.key IN ("' + params.tableIds.join('", "') + '") ';
			}
			query += 'ORDER BY t.name, h.type, h.rank';

			schema.sequelize.query(query).success(function(rows) {
				var result = [];
				async.each(rows, function(row, next){
					result.push({
						type: row.type,
						score: row.score,
						rank: row.rank,
						points: row.points,
						title: row.title,
						info: row.info,
						player: row.player,
						user: row.user,
						tableKey: row.key
					});
					next();
				}, function(err) {
					res({ rows: result, count: rows.length });
				});

			}).error(function(err) {
				throw new Error(err);
			});
		},

		getAvailableUpdate : function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			au.newVersionAvailable(function(err, version) {
				if (err) {
					logger.log('error', '[rpc] [pind] [getAvailableUpdate] %s', err);
					res(error.api(err));
				} else {
					res(version);
				}
			});
		},

		updatePind : function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			if (!params.sha) {
				return res(error.api('Must specify SHA to which revision to update.'));
			}
			au.update(params.sha, function(err, version) {
				if (err) {
					logger.log('error', '[rpc] [pind] [updatePind] %s', err);
					res(error.api(err));
				} else {
					res(version);
				}
			});
		},

		getPreviousUpdates: function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			var p = {
				offset : params.offset ? parseInt(params.offset) : 0,
				limit : params.limit ? parseInt(params.limit) : 0,
				order : 'completedAt DESC'
			};
			schema.Upgrade.all(p).success(function(rows) {
				schema.Upgrade.count().success(function(num) {
					var rs = [];
					_.each(rows, function(row) {
						rs.push(row.map());
					});
					rows = rs;
					res({ rows: rows, count: num });
				});
			});
		},

		Restart: function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			res({ message: 'Got it, will kill myself in two seconds.' });
			setTimeout(function() {
				logger.log('err', '[api] [pind] Killing myself in hope for a respawn.');
				process.kill(process.pid, 'SIGTERM');
			}, 2000);
		}
	};
};