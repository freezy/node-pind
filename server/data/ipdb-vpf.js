'use strict';

var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var async = require('async');

var schema = require('./../database/schema');

var au = require('./../modules/autoupdate');
var nv = require('./../modules/nvram');
var hs = require('./../modules/hiscore');

var ipdb = require('./../modules/ipdb');
var vp = require('./../modules/visualpinball');
var hp = require('./../modules/hyperpin');

var vpm = require('./../modules/vpinmame');
var vpf = require('./../modules/vpforums');

var logger = require('winston');
logger.cli();

var mapNew = {};
var map;
var mapFile = __dirname + '/ipdb-vpf.json';

if (fs.existsSync(mapFile)) {

	map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));

	schema.VpfFile.all({ where: { category: [ 41, 35, 36, 33, 26, 43, 47, 44, 34, 45, 46] }}).then(function(rows) {

		async.eachSeries(rows, function(row, next) {
			if (map[row.fileId]) {
				logger.log('info', 'Skipping "%s", already in map.', row.title);
				return next();
			}
			row = row.map();


			var m, t;
			if (m = row.title.match(/([^\(]+)\(([^\d]+)(\d{4})\s*\)/)) {
				logger.log('info', 'Going for "%s"',  m[1].trim());
				t = {
					name: m[1].trim(),
					manufacturer: m[2].trim(),
					year: m[3]
				}
			} else {
				logger.log('info', 'Going for "%s"', row.title_trimmed);
				t = {
					name: row.title_trimmed
				};
			}
			ipdb.enrich(t, function(err, table) {
				if (err) {
					return next(err);
				}
				if (table.ipdb_no) {
					if (!ipdb.getKnownManufacturer(table.ipdb_mfg)) {
						return next('Unknown manufacturer: http://ipdb.org/search.pl?searchtype=advanced&mfgid=' + table.ipdb_mfg);
					}
					map[row.fileId] = {
						ipdb: table.ipdb_no,
						title: table.name,
						year: table.year,
						manufacturer: table.manufacturer,
						img: table.img_playfield,
						title_original: row.title,
						title_original_trimmed: row.title_trimmed
					};
				} else {
					table.error = '********** NO MATCH **********';
					table.title_original = row.title;
					table.title_original_trimmed = row.title_trimmed;
					map[row.fileId] = table;
				}
				mapNew[row.fileId] = map[row.fileId];
				next();
			});

		}, function(err) {
			fs.writeFileSync(mapFile, JSON.stringify(map, null, 2));
			_.each(mapNew, function(match) {
				console.log(match.title_original);
				if (match.ipdb) {
					console.log('%s (%s %d)', match.title, match.manufacturer, match.year);
				} else if (match.type == 'OG') {
					console.log('********** ORIGINAL GAME **********');
				} else {
					console.log('********** NO MATCH **********');
				}
				console.log('-----------------------------------------------------------------------------------------------');
			});

			if (err) {
				logger.log('error', err);
			}

			//logger.log('info', 'All done: %s', util.inspect(map, false, 2, true));
		});

	});
} else {
	console.error('Map file at %s not found.' , mapFile);
}