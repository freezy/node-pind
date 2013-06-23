var fs = require('fs');
var util = require('util');
var async = require('async');

var app = require('./server')();

var au = require('./app/modules/autoupdate')();
var nv = require('./app/modules/nvram')();
var hs = require('./app/modules/hiscore')(app);


//git();
//postExtract();
//readAudits();
//readAllAudits();
//readAvailableAudits();

//assertHiscores('w');

nv.diff();

function git() {
	au.update({ sha: '8721605a0fd32594dea1fb53f60c4cca363daf1a', commit: { committer: { date: '2013-06-01T10:31:10Z' }}}, function(err, result) {
		if (err) {
			console.log("ERROR: " + err);
		} else {
			console.log("Done, got: %s", util.inspect(result));
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
			console.log("****** ERROR: %s", err);
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

app.compound.on('ready', function() {

	var ipdb = require('./app/modules/ipdb')(app);
	var vp = require('./app/modules/visualpinball')(app);
	var hp = require('./app/modules/hyperpin')(app);

	var vpm = require('./app/modules/vpinmame')(app);
	var vpf = require('./app/modules/vpforums')(app);
	var trns = require('./app/modules/transfer')(app);
	var extr = require('./app/modules/extract')(app);


	var log = require('winston');
	log.cli();

//	cacheAllTableDownloads();
//	nextDownload();


//	extractMedia('E:/tmp/Party.Animal.FS.rar');
//	extractMedia('E:/tmp/Getaway-HighSpeed2Williams1992HPMEDIAPACKflyerfix.zip');
//	extractMedia('E:/tmp/Medieval-Madness_Night Mod_VP91x_2.4.3FS.rar');
//	vpParse();

//	syncTables2();
//	syncTables();

	//getHighScore('ww_l5');

//	getRomNames();
//	updateRomNames();

	extractMedia('C:/Temp/Cactus.Canyon.High.Noon.Night.Mod.rar');

	//getRomName('BALLY - TWILIGHT ZONE - MEGAPIN - VP9 - V1.0FSHPTEAM.vpt');
	//getRomName('Monster Bash.VP9.V1.1.uw.FS.vpt');
	//getRomName('LOTR_VP91x_2.3FS.vpt');
	//getRomName('STERN - The Simpsons Pinball Party - MEGAPIN_V1.2FS.vpt');

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
		vp.getHighscore(romname, function(err, highscores) {
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

	function syncTables() {
		ipdb.syncTables(function(err) {
			if (err) {
				console.log("ERROR: " + err);
			} else {
				console.log("All done!");
			}
		});
	}

	function syncTables2() {
		console.log('Starting to sync HP tables...');
		hp.syncTables(function(err) {
			if (err) {
				console.log("ERROR: " + err);
			} else {
				console.log("All done!");
			}
		});
	}

	function vpParse() {
		vpf.findMediaPack({ name : 'Elvira and the Party Monsters' }, function(err, whatever) {
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




});