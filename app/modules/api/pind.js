var _ = require('underscore');
var async = require('async');
var util = require('util');

error = require('../error');
var schema = require('../../model/schema');

var ipdb, vpm, hs, api, tableApi, pathTo;

module.exports = function(app) {
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

			if (params.tableIds) {
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
		}
	};
};

exports.api = new PindApi();