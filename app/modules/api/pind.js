var _ = require('underscore');
var util = require('util');
var async = require('async');
var relativeDate = require('relative-date');

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
			version.dateSince = relativeDate(version.date);
			version.url = 'https://github.com/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/commit/' + version.sha;
			callback(version);
		},

		GetAvailableUpdate : function(req, params, callback) {
			au.newVersionAvailable(function(err, version) {
				if (err) {
					return callback(error.api(err));
				}
				console.log('Available version: %j', version);
				callback(version);
			});
		}
	};
};

exports.api = new PindApi();