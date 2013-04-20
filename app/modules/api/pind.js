var async = require('async');
var util = require('util');

var api = require('../api');
var ipdb = require('../ipdb');
var vpm = require('../vpinmame');
var schema = require('../../model/schema');

var tableApi = require('./table').api;
var pathTo;

module.exports = function(app) {
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

		GetHiscores : function(req, params, callback) {
			schema.sequelize.query(
				'SELECT h.*, t.key, u.user FROM users u, hiscores h, tables t ' +
				'WHERE u.id = h.userId ' +
				'AND t.id = h.tableId ' +
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
						player: row.user,
						tableKey: row.key
					});
					next();
				}, function(err) {
					callback(result);
				});

			}).error(function(err) {
				throw new Error(err);
			});
		}
	};
};

exports.api = new PindApi();