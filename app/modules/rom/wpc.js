var _ = require('underscore');
var async = require('async');

function WPC(ram, rom) {

	var that = this;
	this.audits = {};

	// checks for a given rom
	this.is = function(prefix) {
		return rom.substr(0, prefix.length).toLowerCase() == prefix.toLowerCase();
	}

	this.readHex = function(pos, len) {
		var num = 0;
		for (var i = 0; i < len; i++) {
			num += ram.readUInt8(pos + i) * Math.pow(256, len - i - 1);
		}
		return num;
	};
	this.readHexWithChecksum = function(pos, len) {
		var checksum = function(pos, len) {
			var c = 0;
			for (var i = 0; i < len; i++) {
				c += ram.readUInt8(pos + i);
			}
			return 255 - (c % 256);
		}
		var value = this.readHex(pos, len);
		var valueCheck = ram.readUInt8(pos + len + 2);
		if (valueCheck == checksum(pos, 3)) {
			return value;
		} else {
			return false;
		}
	};

	/**
	 * Reads the following from main audits:
	 *
	 * 	- B.1 09 Extra Balls
	 *
	 * @param next
	 */
	this.readMainAudits = function(next) {
		that.audits.extraBalls = that.readHexWithChecksum(0x18b3, 3);
		next();
	}

	/**
	 * Reads the following from standard audits:
	 *
	 * 	- B.3 01 Games Started
	 * 	- B.3 02 Total Plays
	 * 	- B.3 21 Play Time
	 * 	- B.3 22 Minutes On
	 * 	- B.3 23 Balls Played
	 * @param next
	 */
	this.readStandardAudits = function(next) {
		that.audits.gamesStarted = that.readHexWithChecksum(0x1883, 3);
		that.audits.gamesPlayed = that.readHexWithChecksum(0x1889, 3);
		that.audits.playTime = that.readHexWithChecksum(0x18b9, 3) * 10000;
		that.audits.runningTime = that.readHexWithChecksum(0x18bf, 3) * 60000;
		that.audits.ballsPlayed = that.readHexWithChecksum(0x18c5, 3);
		next();
	}

	/**
	 * Reads all histogram data from:
	 *
	 *  - B.5 Histograms
	 *
	 * @param next
	 */
	this.readHistograms = function(next) {

		var histoScores = {
			afm_ : ['0M', '200M', '400M', '600M', '800M', '1B', '1.5B', '2B', '3B', '4B', '5B', '7B', '9B'],
			mm_ : ['0M', '1M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '60M', '70M', '80M', '90M'],
			t2_ : ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '70M', '100M', '150M', '200M', '300M']
		};

		var readScoreHistogram = function(scores) {
			var histogram = [];
			for (var i = 0; i < scores.length; i++) {
				histogram.push({
					score: scores[i],
					num: that.readHexWithChecksum(0x191f + (i * 6), 3)
				});
			}
			that.audits.scoreHistogram = histogram;
		}

		var readTimeHistogram = function() {

			var durations = [ 0, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 900 ];
			var histogram = [];
			for (var i = 0; i < durations.length; i++) {
				histogram.push({
					duration: durations[i],
					num: that.readHexWithChecksum(0x196d + (i * 6), 3)
				});
			}
			that.audits.playtimeHistogram = histogram;
		}

		_.each(histoScores, function(scores, prefix) {
			if (that.is(prefix)) {
				readScoreHistogram(scores);
			}
		});
		readTimeHistogram();
		next();
	};

	this.readAudit = function(callback) {
		async.series([that.readMainAudits, that.readStandardAudits, that.readHistograms], function(err) {
			if (err) {
				return callback(err);
			}
			// clean up and return
			var ttl = 0;
			var fnd = 0;
			for (var key in that.audits) {
				if (!that.audits.hasOwnProperty(key)) {
					continue;
				}
				if (that.audits[key] === false) {
					delete that.audits[key];
				} else {
					fnd++;
				}
				ttl++;
			}
			that.audits.match = fnd / ttl;
			callback(null, that.audits);
		});
	}
}


module.exports = WPC;