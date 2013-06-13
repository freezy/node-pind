var _ = require('underscore');
var async = require('async');

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
		ballsPlayed: Stern.prototype._readHexAsDec(buf, 0x1830, 4), // 01 Total Balls Played
		extraBalls: Stern.prototype._readHexAsDec(buf, 0x182c, 4),  // 02 Total Extra Balls
		gamesPlayed: Stern.prototype._readHexAsDec(buf, 0x17f8, 4), // 14 Total Plays
		scoreHistogram: Stern.prototype._readScoreHistograms(buf, rom) // 15 - 31 Standard Audit
	};

	callback(null, audits);
};

Stern.prototype._readScoreHistograms = function(buf, rom) {

	var histoScores = {
		ripleys : ['0M', '500K', '1M', '2M', '3M', '4M', '6M', '8M', '10M', '12M', '14M', '16M', '18M', '20M', '25M', '30M', '40M']
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
	return parseInt(num);
}

module.exports = Stern;