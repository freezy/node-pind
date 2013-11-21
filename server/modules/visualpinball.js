'use strict';

var _ = require('underscore');
var fs = require('fs');
var ocd = require('ole-doc').OleCompoundDoc;
var util = require('util');
var async = require('async');
var events = require('events');
var logger = require('winston');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');

var an = require('./announce');
var md2 = require('./md2');

function VisualPinball() {
	events.EventEmitter.call(this);
	this.initAnnounce();
}
util.inherits(VisualPinball, events.EventEmitter);


/**
 * Sets up event listener for realtime updates via Socket.IO.
 */
VisualPinball.prototype.initAnnounce = function() {

	// updateTableData()
	an.notice(this, 'analysisStarted', 'Analyzing {{name}}...', 'admin');
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
 * @param tablePath Path to the .vpt file. File must exist.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Table script</li></ol>
 */
VisualPinball.prototype.readScriptFromTable = function(tablePath, callback) {
	if (!fs.existsSync(tablePath)) {
		return callback('File "' + tablePath + '" does not exist.');
	}
	var now = new Date().getTime();

	var doc = new ocd(tablePath);
	doc.on('err', function(err) {
		callback(err);
	});
	doc.on('ready', function() {
		var storage = doc.storage('GameStg');
		if (storage) {
			try {
				var stream = storage.stream('GameData');
				stream.on('data', function(buf) {
					logger.log('info', '[vp] [script] Found GameData in %d ms.', new Date().getTime() - now);

					var data = buf.toString();
					//logger.log('info', data);
				});
			} catch(err) {
				callback('Cannot find stream "GameData" in storage "GameStg".');
			}
		} else {
			callback('Cannot find storage "GameStg".');
		}
	});
	doc.read();

	/*

    fs.open(tablePath, 'r', function(err, fd) {

		var script = getScriptPosition(fd);
		var buf = new Buffer(script.end - script.start);

		logger.log('info', '[vp] [script] Found positions %d and %d (%d bytes) in %d ms.', script.start, script.end, script.end - script.start, new Date().getTime() - now);
		fs.readSync(fd, buf, 0, buf.length, script.start);
		fs.closeSync(fd);
		callback(null, buf.toString());
	});*/
};

/**
 * File structure see PinTable::SaveData() at pintable.cpp
 * @param tablePath
 * @param scriptData
 * @param callback
 * @returns {*}
 */
VisualPinball.prototype.writeScriptToTable = function(tablePath, scriptData, callback) {
	if (!fs.existsSync(tablePath)) {
		return callback('File "' + tablePath + '" does not exist.');
	}
	fs.open(tablePath, 'r+', function(err, fd) {

		var scriptPos = getScriptPosition(fd);
		var tailBuf = new Buffer(scriptPos.fileSize - scriptPos.end);
		var scriptBuf = new Buffer(scriptData);
		var lenBuf = new Buffer(4);
		var lenRevBuf = new Buffer(4);
		lenBuf.writeInt32BE(scriptData.length, 0);
		lenRevBuf[0] = lenBuf[3]; lenRevBuf[1] = lenBuf[2]; lenRevBuf[2] = lenBuf[1]; lenRevBuf[3] = lenBuf[0];

		var eof = scriptPos.endb + scriptData.length - (scriptPos.end - scriptPos.start);
		var newSize = eof - (eof % 4096) + 4096;
		logger.log('info', '[vp] [script] OLD ENDB is at position %d', scriptPos.endb);
		logger.log('info', '[vp] [script] NEW ENDB is at position %d', eof);

		logger.log('info', '[vp] [script] Writing script back to "%s"', tablePath);
		fs.readSync(fd, tailBuf, 0, tailBuf.length, scriptPos.end);
		//console.log('TAIL1 = \n' + tailBuf.toString());
		// truncate file
		fs.truncate(fd, scriptPos.start + scriptData.length + tailBuf.length);
		// write script
		fs.writeSync(fd, lenRevBuf, 0, 4, scriptPos.start - 4);
		fs.writeSync(fd, scriptBuf, 0, scriptBuf.length, scriptPos.start);
		// write tail
		fs.writeSync(fd, tailBuf, 0, tailBuf.length, scriptPos.start + scriptBuf.length);

		// fill up with 00s
		fs.truncate(fd, eof);
		var i;
		var nullBuf = new Buffer(newSize - eof);
		//FIXME: nullBuf.fill(0x0);
		for (i = 0; i < nullBuf.length; i++) {
			nullBuf[i] = 0x00;
		}
		fs.writeSync(fd, nullBuf, 0, nullBuf.length, eof);

		// save
		fs.closeSync(fd);
		callback();
	});
};


/**
 * Returns the position of the script.
 *
 * Table scripts are at the end of the .vpt file. The header of the chunk equals
 * 04 00 00 00 43 4F 44	45 (0x04 0 0 0 "CODE") and ends with 04 00 00 00.
 *
 * @param fd
 * @returns {{start: int, end: int, fileSize: int, endb: int}}
 */
var getScriptPosition = function(fd) {

	var stat = fs.fstatSync(fd);
	var buf = new Buffer(8);
	var scriptStart, scriptEnd, endb;
	for (var i = stat.size; i > 0; i--) {
		fs.readSync(fd, buf, 0, buf.length, i - buf.length);
		if (buf[4] == 0x04 && buf[5] == 0x00 && buf[6] == 0x00 && buf[7] == 0x00) { // 0400
			scriptEnd = i - 4;
		}
		if (buf[0] == 0x04 && buf[1] == 0x00 && buf[2] == 0x00 && buf[3] == 0x00 &&  // 0400
			buf[4] == 0x43 && buf[5] == 0x4f && buf[6] == 0x44 && buf[7] == 0x45) {  // CODE
			scriptStart = i + 4;
			break;
		}
		if (buf[0] == 0x04 && buf[1] == 0x00 && buf[2] == 0x00 && buf[3] == 0x00 &&  // 0400
			buf[4] == 0x45 && buf[5] == 0x4e && buf[6] == 0x44 && buf[7] == 0x42) {  // ENDB
			endb = i;
		}
	}
	return { start: scriptStart, end: scriptEnd, endb: endb, fileSize: stat.size };
};

VisualPinball.prototype.writeChecksum = function(tablePath, callback) {
	if (!fs.existsSync(tablePath)) {
		return callback('File "' + tablePath + '" does not exist.');
	}

	var dumpHashdata = false;
	var now = new Date().getTime();
	var doc = new ocd(tablePath);

	doc.on('err', function(err) {
		callback(err);
	});
	doc.on('ready', function() {

		var hashBuf = [];
		var hashSize = 0;
		var hashKeyBuf = [];

		var makeHash = function() {
			var buf = Buffer.concat(hashBuf);
			hashSize = buf.length;
			if (dumpHashdata) {
				var i, s = '', t = '';
				for (i = 0; i < buf.length; i++) {
					if (i % 16 == 0) {
						s += ' ' + t + '\n';
						t = '';
					}
					s += buf.slice(i, i+1).toString('hex').toUpperCase() + ' ';
					t += buf.slice(i, i+1).readInt8(0) ? buf.slice(i, i+1).toString('utf8').trim() : ' ';
				}
				fs.writeFileSync('data.pind.txt', s);
				console.log(s);
			}
			return md2.buf(buf);
		};
		var addStream = function(key, st, next) {
			var bufs = [];
			var pstmItem = st.stream(key);
			pstmItem.on('data', function(buf) {
				bufs.push(buf);
			});
			pstmItem.on('end', function() {
				var buf = Buffer.concat(bufs);
				logger.log('info', '[vpf] [checksum] Adding entire stream %s (%d)', key, buf.length);
				hashBuf.push(buf);
				next();
			});
		};
		var loadBiff = function(key, st, callback) {
			var bufs = [];
			var strm = st.stream(key);
			strm.on('data', function(buf) {
				bufs.push(buf);
			});
			strm.on('end', function() {
				var buf = Buffer.concat(bufs);
				var tag, data, blockSize, block;
				var blocks = [];
				var i = 0;
				logger.log('info', '[vpf] [checksum] Adding BIFF stream %s (%d)', key, buf.length);
				do {
					blockSize = buf.slice(i, i + 4).readInt32LE(0);  // size of the block excluding the 4 size bytes
					block = buf.slice(i + 4, i + 4 + blockSize);     // contains tag and data
					tag = block.slice(0, 4).toString();
					//noinspection FallthroughInSwitchStatementJS
					switch (tag) {
						case 'ENDB': // do nothing
							break;
						case 'CODE':
							i += 8;
							blockSize = buf.slice(i, i + 4).readInt32LE(0);
							block = buf.slice(i + 4, i + 4 + blockSize);
							block = Buffer.concat([new Buffer(tag), block]);
						default:
							data = block.slice(4);
							blocks.push({ tag: tag, data: data });
							i += blockSize + 4;
							break;
					}
					//console.log('*** Adding block [%d] %s', blockSize, block);
					//console.log('*** Adding block [%d] %s', blockSize, block.length > 100 ? block.slice(0, 100) : block);
					hashBuf.push(block);
					var blk = block.length > 16 ? block.slice(0, 16) : block;
					console.log('*** Added block %s %s (%d / %d bytes): %s | %s', tag, makeHash().toString('hex'), blockSize, hashSize, blk.toString('hex'), blk);
				} while (tag != 'ENDB');
				callback(null, blocks);
			});
			//strm.on('error', callback);
		};

		hashBuf.push(new Buffer('Visual Pinball'));
		hashKeyBuf.push(new Buffer('Visual Pinball'));
		logger.log('info', '[vpf] [checksum] Starting');

		var pstgData = doc.storage('GameStg');
		var pstgInfo = doc.storage('TableInfo');

		if (pstgData && pstgInfo) {
			async.series([
				function(next) { addStream('Version', pstgData, next) },
				function(next) { addStream('TableName', pstgInfo, next) },    // ReadInfoValue(pstg, L"TableName", &m_szTableName, hcrypthash);
				function(next) { addStream('AuthorName', pstgInfo, next) },
				function(next) { addStream('TableVersion', pstgInfo, next) },
				function(next) { addStream('ReleaseDate', pstgInfo, next) },
				function(next) { addStream('AuthorEmail', pstgInfo, next) },
				function(next) { addStream('AuthorWebSite', pstgInfo, next) },
				function(next) { addStream('TableBlurb', pstgInfo, next) },
				function(next) { addStream('TableDescription', pstgInfo, next) },
				function(next) { addStream('TableRules', pstgInfo, next) },
				function(next) { loadBiff('CustomInfoTags', pstgData, function(err, blocks) {
					if (err) return next(err);
					var infoTags = [];
					_.each(blocks, function(block) {
						infoTags.push(block.data.slice(4).toString('utf8'));
					});
					async.eachSeries(infoTags, function(infoTag, next) {
						addStream(infoTag, pstgInfo, next)
					}, next);
				})},
				function(next) { loadBiff('GameData', pstgData, next) }
			], function(err) {
				if (err) {
					return callback(err);
				}
				var hash = makeHash();
				logger.log('info', '[vpf] HASH: %s, computed in %dms', hash.toString('hex'), new Date().getTime() - now);
			});
		} else {
			callback('Cannot find storage "GameStg" and "TableInfo".');
		}

	});
	doc.read();
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
				logger.log('warn', '[vp] Table file "' + tablePath + '" does not exist.');
				return next();
			}

			that.emit('analysisStarted', { name: row.name });
			that.getTableData(tablePath, function(err, attrs) {
				if (err) {
					return next();
				}
				row.updateAttributes(attrs, [ 'rom', 'rom_file', 'dmd_rotation', 'controller']).done(next);
			});

		}, callback);
	}).error(callback);
};

VisualPinball.prototype.getTableData = function(path, callback) {
	var that = this;

	// read script from table
	that.readScriptFromTable(path, function(err, script) {
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

					logger.log('warn', '[vp] Got table data, returning now.');
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