'use strict';

var fs = require('fs');
var ocd = require('ole-doc').OleCompoundDoc;
var util = require('util');
var async = require('async');
var events = require('events');
var logger = require('winston');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var an = require('./announce');

function VisualPinball() {
	events.EventEmitter.call(this);
	this.initAnnounce();
}
util.inherits(VisualPinball, events.EventEmitter);


/**
 * Sets up event listener for realtime updates via Socket.IO.
 * @param app Express application
 */
VisualPinball.prototype.initAnnounce = function() {

	// updateTableData()
	an.notice(this, 'analysisStarted', 'Analyzing {{name}}...');
};


/**
 * Finds the table name for a given file name.
 * @param table Object with filename set
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Name of the game</li></ol>
 */
VisualPinball.prototype.identify = function(table, callback) {

	// those are applied multiple times as long as stuff gets stripped
	var prestrip = [
		/^fs\s/i,
		/^vp9\d*\s/i,
		/^jp\s/i
	];

	// those are applied once, in that order.
	var stripme = [
		/\(.*/,
		/\[[^\[]+\]/,
		/\sfs\s.*/i,
		/\svp9.*/i,
		/\sv\s*\d\s.*/i,
		/\shr\svpt/i,
		/megapin|stern|bally|chrome|gi8|bmpr/gi,
		/night\s?mod/i,
		/ce\stipoto.*/i,
		/\stpw\slh/i
	];

	// like prestrip, those are also executed as long as they manipulate the string.
	var postprocess = [
		// make two words out of camel cases
		function(str) { return str.replace(/([a-z])([A-Z][a-z])/, '$1 $2'); },
		// make two words out of trailing number
		function(str) { return (str + (' ')).replace(/([a-z])(\d+\s)/, '$1 $2 ').trim(); },
		// strip other crap
		function(str) { return (str + (' ')).replace(/\s(ur|nf|uw|mod)\s/ig, ' '); },
		// game-specfic regexes
		function(str) { return str.replace(/hs2/i, 'High Speed II'); },
		function(str) { return str.replace(/^tom$/i, 'Theatre of Magic'); },
		function(str) { return str.replace(/^taf$/i, 'The Addams Family'); },
		function(str) { return str.replace(/^t2$/i, 'Terminator 2 Judgment Day'); },
		function(str) { return str.replace(/^afm$/i, 'Attack from Mars'); },
		function(str) { return str.replace(/^arfm$/i, 'Revenge from Mars'); }
	];

	var name = table.filename, before, i;

	// replace special chars by spaces
	name = name.replace(/[\.\-_]/ig, ' ');
	do {
		before = name;
		for (i = 0; i < prestrip.length; i++) {
			name = name.replace(prestrip[i], '');
		}
	} while (name != before);
	for (i = 0; i < stripme.length; i++) {
		name = name.replace(stripme[i], '');
	}
	name = name.replace(/[^a-z0-9]/ig, ' ');
	do {
		before = name;
		for (i = 0; i < postprocess.length; i++) {
			name = postprocess[i](name.trim());
		}
	} while (name != before);


	name = name.replace(/\s+/ig, ' ');
	table.name = name.trim();
	callback()
};

/**
 * Returns the ROM name for a given table.
 *
 * Tries to determine which ROM is used for a table. It does it by looking
 * at the table script and intelligently guessing most recently used ROM.
 *
 * @param script Table script body
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Name of the game ROM</li></ol>
 */
VisualPinball.prototype.getRomName = function(script, callback) {
	var that = this;
	var m = script.match(/\.GameName\s*=\s*(.+)/);
	if (m) {

		var getVariableValue = function(name) {
			var regex = new RegExp('^\\s*[^\']*' + name + '\\s*=\\s*(.+)', 'im');
			var m = script.match(regex);
			return m ? m[1] : null;
		};
		var getIntValue = function(str) {
			var m;
			if (m = str.match(/&h(\d+)/i)) {
				return parseInt(m[1], 16)
			}
			return parseInt(str);
		};
		var getStrValue = function(str) {
			var m;
			if (m = str.match(/"([^"]+)"/i)) {
				return m[1];
			}
			return str;
		};
		var getOptionsValue = function(varName, callback) {
			var valueDef = getVariableValue(varName);
			var m;
			if (m = valueDef.match(/LoadValue\("([^"]+)",\s*"([^"]+)"\)/i)) {
				that.getTableSetting(m[1], m[2], callback);

			} else if (m = valueDef.match(/LoadValue\(([^"]+),\s*"([^"]+)"\)/i)) {
				that.getTableSetting(getStrValue(getVariableValue(m[1])), m[2], callback);

			} else {
				callback('Cannot parse options value.');
			}
		};
		var gameName;
		if (m[1].match(/\W/)) {
			gameName = m[1];
		} else {
			gameName = getVariableValue(m[1]);
		}

		// direct hit, all good.
		if (gameName.indexOf('"') == 0) {
			callback(null, gameName.match(/"([^"]+)/)[1]);
			return;
		}

		// Array(Romset1,Romset2,Romset3,Romset4,Romset5,Romset6,Romset7,Romset8)((tzOptions And (15*cOptRom))\cOptRom)
		if (m = gameName.match(/Array\((\w+\d,?\s*){2,}\)\s*\(\((\w+)\s*And\s*\((\d+)\s*\*\s*(\w+)\)\s*\)\s*\\\s*(\w+)\s*\)/i)) {
			var optionsVar = m[2];     // tzOptions
			var multiplicator = m[3];  // 15
			var constantVar = m[4];    // cOptRom
			var romVars = gameName.match(/Array\(([^\)]+)\)/i)[1].split(',');

			getOptionsValue(optionsVar, function(err, optionsVal) {
				var arrayPos;
				if (err) {
					// if nothing found (maybe game has never been run), return the first defined rom
					arrayPos = 0;
				} else {
					var constantVal = getIntValue(getVariableValue(constantVar));
					arrayPos = Math.floor((optionsVal & (multiplicator * constantVal)) / constantVal);
				}
				var romVar = romVars[arrayPos].trim();
				var romName = getVariableValue(romVar);
				callback(null, getStrValue(romName));
			});

		} else {
			callback('Could not find currently used ROM in script.');
		}

	} else {
		callback('Could not find ".GameName" in the script anywhere.');
	}
};

VisualPinball.prototype.getDmdOrientation = function(script, callback) {
	var m = script.match(/\.Games\([^\)]+\)\.Settings\.Value\("ro[lr]"\)\s*=\s*(\d+)/i);
	if (m) {
		return callback(null, m[1]);
	}
	callback('No DMD orientation setting found.');
};

VisualPinball.prototype.getController = function(script, callback) {
	var m = script.match(/Set\s*Controller\s*=\s*CreateObject\("([^"]+)"/i);
	if (m) {
		return callback(null, m[1]);
	}
	callback('No Controller object declaration found.');
};


/**
 * Returns a specific setting for a given table.
 *
 * Table settings are saved using SaveValue within a table script, which instructs
 * VP to store the value somewhere. VP uses Microsoft's CFBF do store the data
 * in a file called VPReg.stg.
 *
 * See also http://en.wikipedia.org/wiki/Compound_File_Binary_Format.
 * Fortunately there's already a JS implementation that reads CFBF.
 *
 * @param storageName The name of the storage
 * @param streamName The name of the "file" in the storage
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Integer} Table setting</li></ol>
 */
VisualPinball.prototype.getTableSetting = function(storageName, streamName, callback) {
	var doc = new ocd(settings.visualpinball.path + '/User/VPReg.stg');
	doc.on('err', function(err) {
		callback(err);
	});
	doc.on('ready', function() {
		var storage = doc.storage(storageName);
		if (storage) {
			try {
				var stream = storage.stream(streamName);
				stream.on('data', function(buf) {
					var data = buf.toString();
					logger.debug('[vp] [ole] Got buffer at ' + buf.length + ' bytes length: ' + data);
					callback(null, parseInt(data.replace(/\0+/g, '')));
				});
			} catch(err) {
				callback('Cannot find stream "' + streamName + '" in storage "' + storageName + '".');
			}
		} else {
			callback('Cannot find storage "' + storageName + '".');
		}
	});
	doc.read();
};

/**
 * Extracts the table script from a given .vpt file.
 *
 * Table scripts are at the end of the .vpt file. The header of the chunk equals
 * 04 00 00 00 43 4F 44	45 (0x04 0 0 0 "CODE") and ends with 04 00 00 00.
 *
 * @param tablePath Path to the .vpt file. File must exist.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Table script</li></ol>
 */
VisualPinball.prototype.getScriptFromTable = function(tablePath, callback) {
	if (!fs.existsSync(tablePath)) {
		return callback('File "' + tablePath + '" does not exist.');
	}
	var now = new Date().getTime();
	//noinspection JSCheckFunctionSignatures
    fs.open(tablePath, 'r', function(err, fd) {
		var stat = fs.fstatSync(fd);
		//noinspection JSUnresolvedFunction
        var buf = new Buffer(8);
		logger.debug('[vp] [script] Found ' + tablePath + ' at ' + stat.size + ' bytes.');
		var scriptStart, scriptEnd;
		for (var i = stat.size; i > 0; i--) {
			fs.readSync(fd, buf, 0, buf.length, i - buf.length);
			if (buf[4] == 0x04 && buf[5] == 0x00 && buf[6] == 0x00 && buf[7] == 0x00) {
				scriptEnd = i - 4;
			}
			if (buf[0] == 0x04 && buf[1] == 0x00 && buf[2] == 0x00 && buf[3] == 0x00 &&
				buf[4] == 0x43 && buf[5] == 0x4f && buf[6] == 0x44 && buf[7] == 0x45) {
				scriptStart = i + 4;
				break;
			}
		}
		//noinspection JSUnresolvedFunction
        buf = new Buffer(scriptEnd - scriptStart);
		logger.debug('[vp] [script] Found positions ' + scriptStart + ' and ' + scriptEnd + ' in ' + (new Date().getTime() - now) + ' ms.');
		fs.readSync(fd, buf, 0, buf.length, scriptStart);
		fs.closeSync(fd);
		callback(null, buf.toString());
	});
};

/**
 * Processes all tables.
 *
 * @param iterator To be exectued on every table, invoked with two arguments:
 * 	<ol><li>{String} Full path to .vpt table file</li>
 * 		<li>{Function} callback that has to be called in order to proceed. Only one parameter, indicating error.</li></ol>
 * @param callback To be executed when all tables are processed, invoked with one argument, indicating error.
 */
VisualPinball.prototype.scanDirectory = function(iterator, callback) {

	var path = settings.visualpinball.path + '/tables';
	fs.readdir(path, function(err, files) {
		var tables = [];
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
			if (file.substr(file.length - 3, file.length).toLowerCase() == 'vpt') {
				tables.push({ path: path + '/' + file, filename: file });
			}
		}
		async.eachSeries(tables, iterator, callback);
	})
};

/**
 * Goes through all VP tables, reads the ROM name from the table file if
 * available and updates the database. Also reads the rotation setting.
 *
 * @param callback
 */
VisualPinball.prototype.updateTableData = function(callback) {
	var that = this;

	// fetch all VP tables
	schema.Table.findAll({ where: { platform: 'VP' }}).success(function(rows) {
		async.eachSeries(rows, function(row, next) {

			// skip if file doesn't exist.
			var tablePath = settings.visualpinball.path + '/tables/' + row.filename + '.vpt';
			if (!fs.existsSync(tablePath)) {
				logger.warn('[vp] Table file "' + tablePath + '" does not exist.');
				return next();
			}

			that.emit('analysisStarted', { name: row.name });
			that.getTableData(tablePath, function(err, attrs) {
				if (err) {
					return next();
				}
				row.updateAttributes(attrs).done(callback);
			});

		}, callback);
	}).error(callback);
};

VisualPinball.prototype.getTableData = function(path, callback) {
	var that = this;

	// read script from table
	that.getScriptFromTable(path, function(err, script) {
		if (err) {
			logger.log('warn', '[vp] Error getting script: ' + err);
			return callback(err);
		}

		// parse rom name
		that.getRomName(script, function(err, rom) {
			if (err) {
				logger.log('warn', '[vp] Could not read ROM name: ' + err);
				rom = null;
			}

			// read orientation
			that.getDmdOrientation(script, function(err, rotation) {
				if (err) {
					logger.log('warn', '[vp] Could not read DMD rotation: ' + err);
					rotation = null;
				}

				// read controller
				that.getController(script, function(err, controller) {
					if (err) {
						logger.log('warn', '[vp] Could not read controller: ' + err);
						controller = null;
					}

					callback(null, {
						rom: rom,
						rom_file: fs.existsSync(settings.vpinmame.path + '/roms/' + rom + '.zip'),
						dmd_rotation: rotation,
						controller: controller
					});
				});
			});
		});
	});

};

module.exports = new VisualPinball();