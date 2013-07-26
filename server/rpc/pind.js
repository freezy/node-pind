var _ = require('underscore');
var util = require('util');
var async = require('async');
var logger = require('winston');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var au = require('../modules/autoupdate')();
var hs = require('../modules/hiscore')();
var hp = require('../modules/hyperpin')();
var vpm = require('../modules/vpinmame')();
var ipdb = require('../modules/ipdb')();
var error = require('../modules/error');

exports.actions = function(req, res, ss) {
	req.use('session');

	return {
		name : 'Pind',

		status: function() {
			var status = {
				user: req.session.user,
				version: au.getVersion(),
				test: 'foobar',
				processing: {
					hp: hp.isSyncing(),
					ipdb: ipdb.isSyncing()
				}
			};

			//console.log('STATUS = %s', util.inspect(req.session, false, 10, true));
			res(status);
		},

		fetchIpdb : function() {
			ipdb.syncIPDB(function(err) {
				if (err) {
					logger.log('error', '[rpc] [pind] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		},

		FetchHiscores : function() {
			hs.fetchHighscores(function(err) {
				if (!err) {
					res({ message: 'High scores updated successfully.' });
				} else {
					res(error.api(err));
				}
			});
		},

		FetchMissingRoms : function() {
			vpm.fetchMissingRoms(function(err, filepaths) {
				if (!err) {
					res({ message: 'High scores updated successfully.', filepaths: filepaths });
				} else {
					res(error.api(err));
				}
			});
		},

		getHiscores : function(params) {
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

		getVersion : function() {
			res(au.getVersion());
		},

		GetAvailableUpdate : function() {
			au.newVersionAvailable(function(err, version) {
				if (err) {
					return res(error.api(err));
				}
				res(version);
			});
		},

		UpdatePind : function(params) {
			if (!params.sha) {
				return res(error.api('Must specify SHA to which revision to update.'));
			}
			au.update(params.sha, function(err, version) {
				if (err) {
					return res(error.api(err));
				}
				res(version);
			});
		},

		getPreviousUpdates: function(params) {
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
			res({ message: 'Got it, will kill myself in two seconds.' });
			setTimeout(function() {
				logger.log('err', '[api] [pind] Killing myself in hope for a respawn.');
				process.kill(process.pid, 'SIGTERM');
			}, 2000);
		}
	};
};