var fs = require('fs');
var async = require('async');
var util = require('util');

var api = require('../api');
var ipdb = require('../ipdb');
var vpm = require('../vpinmame');
var schema = require('../../model/schema');
var settings = require('../../../config/settings-mine');

var tableApi = require('./table').api;

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

			var addHighscore = function(hiscore, callback) {
				schema.Hiscore.create({
					type: hiscore.type,
					score: hiscore.score,
					rank: hiscore.rank,
					title: hiscore.title,
					info: hiscore.info
				}).success(function(row) {
					row.setTable(hiscore.table).success(function(row) {
						row.setUser(hiscore.user).success(function(row) {
							callback(null, row);
						}).error(callback);
					}).error(callback);
				}).error(callback);
			}

			schema.Table.all({ where: '`platform` = "VP" AND `rom` IS NOT NULL' }).success(function(rows) {
				var roms = [];
				var tables = {};
				// only retrieve roms that actually have an .nv file.
				for (var i = 0; i < rows.length; i++) {
					if (fs.existsSync(settings.vpinmame.path + '/nvram/' + rows[i].rom + '.nv')) {
						roms.push(rows[i].rom);
						tables[rows[i].rom] = rows[i];
						//break;
					}
				}
				// "cache" users to avoid tons of queries
				schema.User.all().success(function(rows) {
					var users = {};
					for (var i = 0; i < rows.length; i++) {
						users[tr(rows[i].user)] = rows[i];
					}

					async.eachSeries(roms, function(rom, next) {
						vpm.getHighscore(rom, function(err, hiscore) {
							if (err || !hiscore) {
								console.log('Error with rom %s: %s', rom, err);
								next();
							} else {
								var hiscores = [];
								//console.log('Got hiscore: %s', util.inspect(hiscore));
								if (hiscore.grandChampion && users[tr(hiscore.grandChampion.player)]) {
									console.log('[%s] Matched grand champion: %s', rom, hiscore.grandChampion.player);
									hiscores.push({
										type: 'champ',
										score: hiscore.grandChampion.score,
										table: tables[rom],
										user: users[tr(hiscore.grandChampion.player)]
									});
								}
								if (hiscore.highest) {
									for (var i = 0; i < hiscore.highest.length; i++) {
										var hs = hiscore.highest[i];
										if (users[tr(hs.player)]) {
											console.log('[%s] Matched high score %s: %s', rom, hs.rank, hiscore.grandChampion.player);
											hiscores.push({
												type: 'hiscore',
												score: hs.score,
												rank: hs.rank,
												table: tables[rom],
												user: users[tr(hs.player)]
											});
										}
									}
								}
								if (hiscore.other) {
									for (var i = 0; i < hiscore.other.length; i++) {
										var hs = hiscore.other[i];
										if (users[tr(hs.player)]) {
											console.log('[%s] Matched %s: %s', rom, hs.title, hiscore.grandChampion.player);
											hiscores.push({
												type: 'special',
												title: hs.title,
												info: hs.info,
												score: hs.score,
												rank: hs.rank,
												table: tables[rom],
												user: users[tr(hs.player)]
											});
										}
									}
								}
								async.eachSeries(hiscores, addHighscore, next);
							}
						})
					}, function(err) {
						if (err) {
							console.log('ERROR: ' + err);
						}
						console.log('All done!');
					});

				}).error(function(err) {
					throw Error(err);
				});

			}).error(function(err) {
				throw Error(err);
			});
			callback({message: 'all ok.'});
		}
	};
};

function tr(str) {
	return str.toLowerCase().trim();
}

exports.api = new PindApi();
