'use strict';

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var util = require('util');
var async = require('async');

var schema = require('./server/database/schema');
var settings = require('./config/settings-mine');

var au = require('./server/modules/autoupdate');
var nv = require('./server/modules/nvram');
var hs = require('./server/modules/hiscore');

var ipdb = require('./server/modules/ipdb');
var vp = require('./server/modules/visualpinball');
var hp = require('./server/modules/hyperpin');

var vpm = require('./server/modules/vpinmame');
var vpf = require('./server/modules/vpforums');
var trns = require('./server/modules/transfer');
var extr = require('./server/modules/extract');
var s = require('./server/modules/settings');

var logger = require('winston');
logger.cli();


vptChecksumCheck('Big Guns (Williams 1987) 1.00.vpt');

//vptChecksum('E:/Pinball/Visual Pinball-103/Tables/Attack_From_Mars_NIGHT MOD_VP916_v3.1_FS_3-WAY-GI.vpt');
//writeTableScript('E:/Pinball/Visual Pinball-103/Tables/LOTR_VP916_NIGHT_MOD_1.0 - PIND.vpt');
//readTableScript('E:/Pinball/Visual Pinball-103/Tables/LOTR_VP916_NIGHT_MOD_1.0 - Copy2.vpt');

//testEditionParsing();

//findMedia(20);

//validateSettings();

//migrateUp('D:/dev/node-pind/migrations/20130923161738-33cca83-add-parent-to-vpf');

//matchSources();
//ipdbMatch('Mars Attacks');

//git();
//postExtract();
//readAudits();
//readAllAudits();
//readAvailableAudits();

//assertHiscores('w');

//nv.diff();

//postProcessTransfer(1);

//	cacheAllTableDownloads();
//	nextDownload();


//extractMedia('E:/tmp/Safe_Cracker_HPMP.zip');
//extractMedia('E:/tmp/Playboy.Stern.2002.zip');

//	extractMedia('E:/tmp/Medieval-Madness_Night Mod_VP91x_2.4.3FS.rar');
//	vpParse();

// readTables();
//writeTables();
//	syncTables();

//getHighScore('ww_l5');

//	getRomNames();
//	updateRomNames();

//	extractMedia('C:/Temp/Cactus.Canyon.High.Noon.Night.Mod.rar');

//getRomName('BALLY - TWILIGHT ZONE - MEGAPIN - VP9 - V1.0FSHPTEAM.vpt');
//getRomName('Monster Bash.VP9.V1.1.uw.FS.vpt');
//getRomName('LOTR_VP91x_2.3FS.vpt');
//getRomName('STERN - The Simpsons Pinball Party - MEGAPIN_V1.2FS.vpt');

function validateSettings() {
	s.validate();
}

function migrateUp(filename) {
	var migrator = schema.sequelize.getMigrator();
	migrator.exec(filename, {
		before: function(migration) {
			console.log('Starting migration.');
		}
	}).success(function() {
			console.log('Migration executed successfully.');
	}).error(function(err) {
		console.error('Migration went wrong: ', err);
	});
}

function writeTableScript(filename) {
	vp.readScriptFromTable(filename, function(err, data) {
		if (err) {
			console.error("ERROR: " + err);
		} else {
			vp.writeScriptToTable(filename, "'PIND\r\n" + data, function(err) {
				if (err) {
					console.error("ERROR: " + err);
				} else {
					console.log("Successfully wrote script!");
				}
			});
		}
	});
}
// 64710 -> 64702
function readTableScript(filename) {

	vp.readScriptFromTable(filename, function(err, data) {
		if (err) {
			console.error("ERROR: " + err);
		} else {
			console.log("Read successfully.");
		}
	});
}

function vptChecksum(filename) {

	vp.writeChecksum(filename, function(err) {
		if (err) {
			console.error("ERROR: " + err);
		} else {
			console.log("Read successfully.");
		}
	});
}

function vptChecksumCheck(filename) {
	var ocd = require('ole-doc').OleCompoundDoc;
	var files;
	if (filename) {
		if (!fs.existsSync(settings.visualpinball.path + '/tables/' + filename)) {
			throw new Error(settings.visualpinball.path + '/tables/' + filename + ' does not exist.');
		}
		files = [ filename ];
	} else {
		files = fs.readdirSync(settings.visualpinball.path + '/tables');
	}
	async.eachSeries(files, function(file, next) {
		var ext = path.extname(file).toLowerCase();
		if (ext == '.vpt') {
			//console.log(file);
			var filepath = settings.visualpinball.path + '/tables/' + file;
			var doc = new ocd(filepath);
			doc.on('ready', function() {
				console.log('loaded');
				var strm = doc.storage('GameStg').stream('MAC');
				var bufs = [];
				strm.on('data', function(buf) {
					bufs.push(buf);
				});
				strm.on('end', function() {
					var buf = Buffer.concat(bufs);
					console.log('%s - %s', buf.toString('hex'), file);
					next();
				});
				strm.on('err', next);
			});
			doc.on('err', function(err) {
				console.error('Error reading "%s": %s', file, err);
				next();
			});
			console.log('loading');
			doc.read();
		} else {
			next();
		}
	}, function(err) {
		if (err) {
			return console.error("ERROR: " + err);
		}
		console.log('done!');
	});
}

function matchSources() {

	hp.matchSources(function(err, result) {
		if (err) {
			console.error("ERROR: " + err);
		} else {
			console.log("Post processing done!");
			//console.log("Post processing done, got\n%s", util.inspect(result, false, 2, true));
		}
	});
}

function findMedia(tableId) {

	schema.Table.find(tableId).success(function(row) {
		if (row) {
			vpf.findTableVideo(row, null, function(err, result) {
				if (err) {
					console.error("ERROR: " + err);
				} else {
					console.log("Found result: " + result.found);
				}
			});
		} else {
			console.error('No table with ID %s found.', tableId)
		}
	});

}

function postProcessTransfer(id) {
	schema.Transfer.find(id).success(function(row) {
		if (row) {
			trns.postProcess(row, function(err, result) {
				if (err) {
					console.error("ERROR: " + err);
				} else {
					console.log("Post processing done!");
					//console.log("Post processing done, got\n%s", util.inspect(result, false, 2, true));
				}
			})
		} else {
			console.error('No transfer found with row ID ' + id);
		}
	});
}

function git() {
//	au.update({ sha: '8721605a0fd32594dea1fb53f60c4cca363daf1a', commit: { committer: { date: '2013-06-01T10:31:10Z' }}}, function(err, result) {
	au._getCommits('50ae29ca2ed56bff86dc6da959957ef22e7b722f', '191e0e7564188957f9556ed5732f0c4d02c57767', function(err, result) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Got %d results: %s", result.length, util.inspect(result));
		}
	});
}

function postExtract() {

	var newConfig = {
		packageJson: JSON.parse(fs.readFileSync(__dirname + '/package.json').toString()),
		settingsJs: fs.readFileSync(__dirname + '/config/settings.js').toString()
	};
	au._postExtract(null, newConfig, null, function(err) {
		if (err) {
			console.log("****** ERROR: %s", util.inspect(err));
		} else {
			console.log("****** all done.");
		}
	})
}

function readAudits() {
	nv.readAudits('bbb109', function(err, result) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Done, got:\n%s", util.inspect(result));
		}
	});
}

function readAllAudits() {
	nv.readAll(0, function(err, result) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Done, got:\n%s", util.inspect(result));
		}
	});
}

function readAvailableAudits() {
	nv.readTables(function(err, result) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Done, got:\n%s", util.inspect(result));
		}
	});
}

function assertHiscores(startWith) {
	hs.assertAll(startWith, function(err) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("All done!");
		}
	});
}


function updateTableData() {
	vp.updateTableData(function(err) {
		if (err) {
			console.log("****** all done (%s)", err);
		} else {
			console.log("****** all done.");
		}
	});
}

function getRomNames() {
	vp.scanDirectory(function(table, callback) {
		vp.getRomName(table.filename, function(err, romname) {
			console.log("%s %s", romname, table.filename);
			callback();
		});
	}, function(err) {
		if (err) {
			console.log("all done (%s)", err);
		} else {
			console.log("all done.");
		}
	});
}


function getHighScore(romname) {
	hs.getHighscore(romname, function(err, highscores) {
		if (!err) {
			console.log(highscores.raw);
			delete highscores.raw;
			console.log(util.inspect(highscores));
		}
	});
}

function getTableSetting() {
	vp.getTableSetting('MBuw', 'Options', function(err, setting) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Got setting: %d", (8192 & 0x1000));

		}
	});
}

function getRomName(tableFile) {
	vp.getRomName(tableFile, function(err, romname) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Got game ROM: " + romname);
		}
	});
}

function updateTable(id) {
	tm.get(id, function(err, game) {
		if (!game) {
			console.log('No such game found.');
			return;
		}
		if (!err) {
			console.log('Enriching: %j', game)
			ipdb.enrich(game, function(err, game) {
				if (!err) {
					console.log('Got: %j', game)
					tm.updateTable(game, function(err, game) {
						if (!err) {
							console.log("updated in db.");
						} else {
							console.log('ERROR: ' + err);
						}
					});
				} else {
					console.log('ERROR: ' + err);
				}
			});
		} else {
			console.log('ERROR: ' + err);
		}
	});
}

function ipdbMatch(name) {
	ipdb.enrich({ name: name }, function(err, table) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Update table: %s", util.inspect(table, false, 10, true));
		}
	});
}

function syncTables() {
	ipdb.syncTables(function(err) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("All done!");
		}
	});
}

function readTables() {
	console.log('Starting to read HP tables...');
	hp.readTables(function(err) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("All done!");
		}
	});
}

function writeTables() {
	console.log('Starting to write HP tables...');
	hp.writeTables(function(err) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("All done!");
		}
	});
}

function vpParse() {
	vpf.findMediaPack({ name: 'Elvira and the Party Monsters' }, function(err, whatever) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("All done!");
		}
	});
};

function extractMedia(filename) {
	extr.extract(filename, null, function(err, files) {
		if (err) {
			return console.log('ERROR: ' + err);
		}
		console.log('Files in archive: ' + util.inspect(files));
	});
}

function cacheAllTableDownloads() {

	vpf.cacheAllTableDownloads(function(err, result) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Received %d results.", result.length);
		}
	});
}

function nextDownload() {
	trns.start(function(err, result) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Done, got: %s", util.inspect(result));
		}
	});
}

function testEditionParsing() {

	var nightmods = [
		'Attack_From_Mars_NIGHT MOD_VP916_3-WAY-GI.', 'Cactus Canyon (High Noon Night Mod)_VP916_FS', 'Cirqus Voltaire [ Night Mod ]_VP916_v2.2_FS_B2S',
		'DR DUDE HR NIGHT MOD', 'DR DUDE Low Res Night Mod', 'Flintstones NIGHT FS JW MOD', 'Grand Lizard FS GI Nightmod',
		'Indiana Jones VP916 FS NIGHT MOD', 'Jokerz! (Night Mod)_VP916_FS_v1.3', 'Medieval-Madness_Night Mod_VP916_V1.2_FS',
		'Star Trek The Next Generation (TNG) FS Night Mod v1.2.1', 'Strikes and Spares Night Mod FS', 'Tales_of_the_Arabian_Nights_[Night Mod]_VP916_FS',
		'Terminator 2 Judgment Day FS Night Mod', 'The FlintStones Night Mod FS', 'The Shadow VP916 FS Night MOD',
		'TOMMY FS BMPR Night MOD VP916', 'TOTAN Night FS', 'Twilight Zone Night Mod FS', 'White Water (Night Mod)_VP916_FS',
		'Attack from Mars - Night Mod [HP VIDEO + AUDIO]', 'Cirqus Voltaire Night Mod [HP VIDEO + AUDIO]', 'TOTAN Night [HP VIDEO + AUDIO]',
		'Attack From Mars (Bally 1995)night [HP VIDEO]', 'Cactus Canyon (Midway 1998)night [HP VIDEO]', 'Cirqus Voltaire (Bally 1997)night [HP VIDEO]',
		'Dr Dude (Midway 1990) night [HP VIDEO]', 'Flintstones, The (Williams 1994) NightModFinal [HP VIDEO]',
		'Simpsons Pinball Party, The (Stern 2003)Night Mod [HP VIDEO]', 'STTNG (Williams 1993)nightmod [HP VIDEO]',
		'Tales of the Arabian Nights (Williams 1996)night [HP VIDEO]',
		'AFM_1_1_night_2.4_Light_Mod_1.0 [HP VIDEO]', 'Attack from Mars (Bally 1995)night [HP VIDEO]', 'Cyclone Night HP VIDEO]',
		'Medieval Madness (Williams 1997)Night [HP VIDEO]', 'Ripley\'s Believe It or Not night (Stern 2004) [HP VIDEO]',
		'Taxi (Night Mod) VP916-FS','Ripleys_Believe_It_or_Not_(NIGHT MOD)_VP916_FS',
		'Lord of the Rings VP916 Night MOD', 'Red and Ted\'s Road Show VP916 Night MOD', 'Elvis Night Mod (VP916_FS)',
		'Taxi (Williams 1988)night [HP VIDEO]', 'Getaway HighspeedII FS GI Dark UNL', 'Mousin Around! FS Dark',
		'Robocop FS GI Darkmod', 'Robocop FS GI darkmod ledwiz', 'Scared Stiff Dark FS', 'Scared Stiff FS Dark MOD by Kruge99',
		'Scared Stiff Dark FS_ver_102 [HP VIDEO]'

	];

	var standards = [
		'Arabian Knights', 'Freddy: a Nightmare on Elm Street', 'Monday Night Football', 'Night Club',
		'Black Knight 2000 FS', 'Black Knight V2.1 FS', 'Freddy: A Nightmare On Elm Street vp9.1x FS', 'Night Rider FS',
		'Tales of the Arabian Nights V2.1FS', 'Tales of the Arabian Nights VP912 FS Classic', 'Viper Night Drivin FS (MOD)',
		'Viper Night Drivn\' FS 0.95 HD', 'Black Knight (Williams 1980) [HP MEDIA PACK]', 'The Dark Knight [HP MEDIA PACK]',
		'Black Knight (Williams 1980) [HP BG VIDEO]', 'Tales of the Arabian Nights (Williams 1996)enhanced [HP VIDEO]',
		'The Dark Knight [HP VIDEO]', 'Dark Rider FS', 'DarkQuest (PolyGame 2008) [HP MEDIA PACK]',
		'The Dark Knight [HP MEDIA PACK]', 'Dark Rider (Geiger 1984) [HP MEDIA PACK]'
	];

	_.each(nightmods, function(item) {
		var edition = schema.Table.getEdition(item);
		if (edition == 'nightmod') {
			logger.log('info', '[%s] %s', edition, item);
		} else {
			logger.log('error', '[%s] %s', edition, item);
		}
	});

	_.each(standards, function(item) {
		var edition = schema.Table.getEdition(item);
		if (edition == 'standard') {
			logger.log('info', '[%s] %s', edition, item);
		} else {
			logger.log('error', '[%s] %s', edition, item);
		}
	});
}


