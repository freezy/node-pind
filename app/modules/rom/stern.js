var _ = require('underscore');
var async = require('async');

/**
 * Findings so far:
 *
 * High score initials start at 0x161d for all ROMs. After that, it's kind
 * of unclear. Right now, I assume:
 *
 *    0x161d Highscore initials - 5 x 10 bytes
 *    0x164f [ A ] (variable length)
 *           Coder credentials - 295 bytes
 *           [ B ] mostly 12 bytes (all 0x00), except ripleys and nascar
 *           Audit start, first value is Total paid credits.
 *
 *    [ A ] seems to be: [ a ] [ X ] [ b ] [ X ] 0x01 [ c ]
 *    where
 *       [ a ] is mostly 7 bytes (except lotr)
 *       [ X ] is 10 bytes
 *       [ b ] is 10 bytes (all 0x0)
 *       [ c ] is between 26 and 30 bytes, no idea what that is.
 *
 * @returns {Stern}
 * @constructor
 */
function Stern() {
	if ((this instanceof Stern) === false) {
		return new Stern();
	}
}

Stern.prototype.isValid = function(buf) {
	return buf.readUInt32BE(0) == 0xdeadbeef;
};

Stern.prototype.readAudits = function(buf, rom, callback) {

	var audits = {
		ballsPlayed: Stern.prototype._readHexAsDec(buf, 0x1830, 4),     // 01 Total Balls Played
		extraBalls: Stern.prototype._readHexAsDec(buf, 0x182c, 4),      // 02 Total Extra Balls
		gamesPlayed: Stern.prototype._readHexAsDec(buf, 0x17f8, 4),     // 14 Total Plays
		scoreHistogram: Stern.prototype._readScoreHistograms(buf, rom), // 15 - 31 Standard Audit
		leftFlipper: Stern.prototype._readHexAsDec(buf, 0x191e, 4),     // 51 Left Flipper Used
		rightFlipper: Stern.prototype._readHexAsDec(buf, 0x1922, 4),     // 52 Right Flipper Used
		playtimeHistogram: Stern.prototype._readPlaytimeHistograms(buf, rom) // 55 - 31 Standard Audit
	};
	// ripleys: Total Plays -> 0x17f8 - Total Paid Credits  0x18f0 (12 + 44 bytes after coder creds)
	// elvis:   Total Plays -> 0x17ca                       0x17c6 (12 bytes after coder creds)
	// lotr:    Total Plays -> 0x17cd                       0x17c9 (12 bytes after coder creds)
	// sopranos                0x17ce                       0x17c6 (12 bytes after coder creds)
	// nascar                  0x17eb                       0x18df (12 + 56 bytes after coder creds)

	callback(null, audits);
};

Stern.prototype._readScoreHistograms = function(buf, rom) {

	var histoScores = {
		ripleys : ['0M', '500K', '1M', '2M', '3M', '4M', '6M', '8M', '10M', '12M', '14M', '16M', '18M', '20M', '25M', '30M', '40M'],
		lotr : ['0M', '2M', '4M', '6M', '8M', '10M', '12.5M', '15M', '17.5M', '20M', '22.5M', '25M', '35M', '50M', '75M', '100M', '150M']
	};
	var readScoreHistogram = function(scores) {
		var histogram = [];
		for (var i = 0; i < scores.length; i++) {
			histogram.push({
				score: scores[i],
				num: Stern.prototype._readHexAsDec(buf, 0x1850 + (i * 4), 4)
			});
		}
		return histogram;
	};

	function is(prefix) {
		return rom.substr(0, prefix.length).toLowerCase() == prefix.toLowerCase();
	}

	for (var prefix in histoScores) {
		if (is(prefix)) {
			return readScoreHistogram(histoScores[prefix]);
		}
	}
	return false;
};

Stern.prototype._readPlaytimeHistograms = function(buf, rom) {
	var durations = [ 0, 60, 90, 120, 150, 180, 210, 240, 300, 360, 480, 600, 900 ];
	var histogram = [];
	for (var i = 0; i < durations.length; i++) {
		histogram.push({
			duration: durations[i],
			num: Stern.prototype._readHexAsDec(buf, 0x18ca + (i * 4), 4)
		});
	}
	return histogram;
};

/**
 * Reads n bytes from RAM into a number and verifies the checksum. On
 * failure, return false.
 *
 * @param buf
 * @param pos Start position
 * @param len Length to read
 * @returns {number|false}
 * @private
 */
Stern.prototype._readHexAsDec = function(buf, pos, len) {
	var num = '';
	for (var i = 0; i < len; i++) {
		var n = buf.readUInt8(pos + i).toString(16);
		num += n.length == 1 ? '0' + n : n;
	}
	num = num.replace(/^0+/g, '');
	return num ? parseInt(num) : 0;
}

module.exports = Stern;