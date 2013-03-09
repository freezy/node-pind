var fs = require('fs');
var ocd = require('ole-doc').OleCompoundDoc;
var config =  require('konphyg')(__dirname + '../../../config');
var settings = config('settings');

/**
 * scripts start after 04 00 00 00 43 4F 44	45 (0x04 0 0 0 "CODE")
 * and ends before 04 00 00 00 00 as well.
 */


exports.getGameRomName = function(tablePath, callback) {
	exports.getScriptFromTable(tablePath, function(err, script) {
		var m = script.match(/\.GameName\s+=\s+([^\s]+)/);
		if (m) {
			console.log('variable : ' + m[1]);
		} else {
			console.log('not found.');
		}
	})
}

exports.getTableSetting = function(storageKey, streamKey, callback) {
	var doc = new ocd(settings.visualpinball.path + '/User/VPReg.stg');
	doc.on('err', function(err) {
		callback(err);
	});
	doc.on('ready', function() {
		var stream = doc.storage(storageKey).stream(streamKey);
		stream.on('data', function(buf) {
			var data = buf.toString();
			console.log('got buffer at %d bytes length: %s', buf.length, data);
			callback(null, parseInt(data.replace(/\0+/g, '')));
		});
	});
	doc.read();
}

exports.getScriptFromTable = function(tablePath, callback) {
	var now = new Date().getTime();
	fs.open(tablePath, 'r', function(err, fd) {
		var stat = fs.fstatSync(fd);
		var buf = new Buffer(8)
		console.log('Read table: %j', stat);
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
		console.log('Found positions %d and %d in %d ms.', scriptStart, scriptEnd, (new Date().getTime() - now));
		fs.readSync(fd, buf, 0, buf.length, scriptStart);
		callback(null, buf.toString());
	});
}