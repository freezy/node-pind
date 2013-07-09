var _ = require('underscore');
var util = require('util');
var async = require('async');
var logger = require('winston');

var error = require('../error');
var schema = require('../../model/schema');
var settings = require('../../../config/settings-mine');

var ipdb, vpm, hs, au, api, tableApi, pathTo;

module.exports = function(app) {
	au = require('../autoupdate')();
	hs = require('../hiscore')(app);
	vpm = require('../vpinmame')(app);
	ipdb = require('../ipdb')(app);
	tableApi = require('./table')(app).api;
	pathTo = app.compound.map.pathTo;
	return exports;
};

var PindApi = function() {
	return {
		name : 'Pind',

		FetchIPDB : function(req, params, callback) {
			ipdb.syncIPDB(function(err, tables) {
				if (err) {
					throw new Error(err);
				}
				tableApi.GetAll(req, params, callback);
			});
		},

		FetchHiscores : function(req, params, callback) {
			hs.fetchHighscores(function(err) {
				if (!err) {
					callback({ message: 'High scores updated successfully.' });
				} else {
					callback(error.api(err));
				}
			});
		},

		FetchMissingRoms : function(req, params, callback) {
			vpm.fetchMissingRoms(function(err, filepaths) {
				if (!err) {
					callback({ message: 'High scores updated successfully.', filepaths: filepaths });
				} else {
					callback(error.api(err));
				}
			});
		},

		GetHiscores : function(req, params, callback) {
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
					callback({ rows: result, count: rows.length });
				});

			}).error(function(err) {
				throw new Error(err);
			});
		},

		GetVersion : function(req, params, callback) {
			var version = au.getVersion();
			callback(version);
		},

		GetAvailableUpdate : function(req, params, callback) {
			au.newVersionAvailable(function(err, version) {
				if (err) {
					return callback(error.api(err));
				}
				callback(version);
			});
		},

		UpdatePind : function(req, params, callback) {
			if (!params.sha) {
				return callback(error.api('Must specify SHA to which revision to update.'));
			}
			au.update(params.sha, function(err, version) {
				if (err) {
					return callback(error.api(err));
				}
				callback(version);
			});
		},

		GetPreviousUpdates: function(req, params, callback) {
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
					callback({ rows: rows, count: num });
				});
			});
		},

		Restart: function(req, params, callback) {
			callback({ message: 'Got it, will kill myself in two seconds.' });
			setTimeout(function() {
				logger.log('err', '[api] [pind] Killing myself in hope for a respawn.');
				process.kill(process.pid, 'SIGTERM');
			}, 2000);
		}
	};
};

exports.api = new PindApi();