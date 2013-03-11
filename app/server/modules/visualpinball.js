var fs = require('fs');
var log = require('winston');
var ocd = require('ole-doc').OleCompoundDoc;
var async = require('async');
var util = require('util');
var config =  require('konphyg')(__dirname + '../../../config');
var settings = config('settings-mine');

/**
 * Finds the table name for a given file name.
 * @param table Object with filename set
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Name of the game</li></ol>
 */
exports.identify = function(table, callback) {

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
 * @param tablePath Path to the .vpt file
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Name of the game ROM</li></ol>
 */
exports.getGameRomName = function(tablePath, callback) {
	exports.getScriptFromTable(tablePath, function(err, script) {
		var m = script.match(/\.GameName\s+=\s+([^\s]+)/);
		if (m) {

			var getVariableValue = function(name) {
				var regex = new RegExp(name + '\\s*=\\s*(.+)');
				var m = script.match(regex);
				return m ? m[1] : null;
			}
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

			console.log('value:' + gameName);

			callback('Could not find currently used ROM in script.');

		} else {
			callback('Could not find ".GameName" in the script anywhere.');
		}
	})
}

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
 * @param storageKey The name of the storage
 * @param streamKey The name of the "file" in the storage
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Integer} Table setting</li></ol>
 */
exports.getTableSetting = function(storageKey, streamKey, callback) {
	var doc = new ocd(settings.visualpinball.path + '/User/VPReg.stg');
	doc.on('err', function(err) {
		callback(err);
	});
	doc.on('ready', function() {
		var stream = doc.storage(storageKey).stream(streamKey);
		stream.on('data', function(buf) {
			var data = buf.toString();
			log.debug('[vp] [ole] Got buffer at ' + buf.length + ' bytes length: ' + data);
			callback(null, parseInt(data.replace(/\0+/g, '')));
		});
	});
	doc.read();
}

/**
 * Extracts the table script from a given .vpt file.
 *
 * Table scripts are at the end of the .vpt file. The header of the chunk equals
 * 04 00 00 00 43 4F 44	45 (0x04 0 0 0 "CODE") and ends with 04 00 00 00.
 *
 * @param tablePath Path to the .vpt file
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Table script</li></ol>
 */
exports.getScriptFromTable = function(tablePath, callback) {
	var now = new Date().getTime();
	fs.open(tablePath, 'r', function(err, fd) {
		var stat = fs.fstatSync(fd);
		var buf = new Buffer(8);
		log.debug('[vp] [script] Found ' + tablePath + ' at ' + stat.size + ' bytes.');
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
		var buf = new Buffer(scriptEnd - scriptStart);
		log.debug('[vp] [script] Found positions ' + scriptStart + ' and ' + scriptEnd + ' in ' + (new Date().getTime() - now) + ' ms.');
		fs.readSync(fd, buf, 0, buf.length, scriptStart);
		callback(null, buf.toString());
	});
}

/**
 * Scans a folder for table files, parses the name and outputs the list.
 *
 * This is still more of a debug function.
 *
 * @param path
 * @param callback
 */
exports.scanDirectory = function(path, callback) {

	fs.readdir(path, function(err, files) {
		var tables = [];
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
			if (file.substr(file.length - 3, file.length).toLowerCase() == 'vpt') {
				tables.push({ path: path + file, filename: file });
			}
		}
		async.eachLimit(tables, 1, exports.identify, function (err) {
			for (var i = 0; i < tables.length; i++) {
				console.log(tables[i].name);// + ' (' + tables[i].filename + ')');
			}
		});
	})
};
