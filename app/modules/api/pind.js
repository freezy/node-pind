var async = require('async');
var util = require('util');

var api = require('../api');
var schema = require('../../model/schema');

var ipdb, vpm, tableApi, pathTo;

module.exports = function(app) {
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
			vpm.fetchHighscores(function(err) {
				if (!err) {
					callback({ message: 'High scores updated successfully.' });
				} else {
					callback(api.error(err));
				}
			});
		},

		FetchMissingRoms : function(req, params, callback) {
			vpm.fetchMissingRoms(function(err, filepaths) {
				if (!err) {
					callback({ message: 'High scores updated successfully.', filepaths: filepaths });
				} else {
					callback(api.error(err));
				}
			});
		},


		GetHiscores : function(req, params, callback) {
			schema.sequelize.query(
				'SELECT h.*, t.key, u.user FROM hiscores h ' +
				'JOIN tables t ON t.id = h.tableId ' +
				'LEFT JOIN users u ON u.id = h.userId ' +
				'ORDER BY t.name, h.type, h.rank'
			).success(function(rows) {
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