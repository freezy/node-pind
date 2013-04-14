var fs = require('fs');
var async = require('async');

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
			schema.Table.all({ where: '`platform` = "VP" AND `rom` IS NOT NULL' }).success(function(rows) {
				var roms = [];
				// only retrieve roms that actually have an .nv file.
				for (var i = 0; i < rows.length; i++) {
					if (fs.existsSync(settings.vpinmame.path + '/nvram/' + rows[i].rom + '.nv')) {
						roms.push(rows[i].rom);
					}
				}
				vpm.init();
				async.eachSeries(roms, function(rom, next) {
					vpm.getHighscore(rom, function(err, hiscore) {
						if (err) {
							console.log('Error: %s', err);
						} else {
							console.log('Got hiscore: %j', hiscore);
						}
						next();
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
			callback({message: 'all ok.'});
		}
	};
};

exports.api = new PindApi();
