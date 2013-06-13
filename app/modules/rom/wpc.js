var _ = require('underscore');
var async = require('async');

function WPC() {
	if ((this instanceof WPC) === false) {
		return new WPC();
	}
}

/**
 * Returns an object containing "interesting" audit values from a RAM file.
 * Example:<pre>
 *	{ extraBalls: 228,
 * 	  gamesStarted: 714,
 * 	  gamesPlayed: 549,
 * 	  playTime: 160770000,
 * 	  runningTime: 530460000,
 * 	  ballsPlayed: 1875,
 * 	  scoreHistogram:
 * 	    [ { score: '0M', num: 6 },
 * 	      { score: '1M', num: 40 },
 * 	      ...
 * 	      { score: '80M', num: 4 },
 * 	      { score: '90M', num: 19 } ],
 * 	  playtimeHistogram:
 * 	    [ { duration: 0, num: 0 },
 * 	      { duration: 60, num: 33 },
 * 	      { duration: 90, num: 54 },
 * 	      ...
 * 	      { duration: 600, num: 40 },
 * 	      { duration: 900, num: 37 } ],
 * 	  match: 1 }
 * </pre>
 * @param ram Buffer containing the contents of the nvram file
 * @param rom Name of the ROM
 * @param callback
 */
WPC.prototype.readAudits = function(ram, rom, callback) {

	var params = {
		rom: rom,
		ram: ram
	};
	async.series([
		this._isValid.bind(params),
		this._readMainAudits.bind(params),
		this._readStandardAudits.bind(params),
		this._readHistograms.bind(params)
	], function(err, auditArray) {
		if (err) {
			return callback(err);
		}

		var audits = {};
		_.each(auditArray, function(a) {
			_.extend(audits, a);
		});

		// clean up and return
		var ttl = 0;
		var fnd = 0;
		for (var key in audits) {
			if (!audits.hasOwnProperty(key) || key == 'isValid') {
				continue;
			}
			if (!audits[key]) {
				delete audits[key];
			} else {
				fnd++;
			}
			ttl++;
		}
		audits.match = fnd / ttl;
		callback(null, audits);
	});
};

WPC.prototype.isValid = function(buf) {
	// gamesStarted
	return WPC.prototype._readHexWithChecksum(buf, 0x1883, 3) !== false;
};

WPC.prototype._isValid = function(next) {

	next(null, {
		isValid: WPC.prototype.isValid(this.ram)
	});

/*	next(null,  {
		isValid : ram.readUInt32BE(0) == 0 && ram.readUInt32BE(4) == 0
			&& ram.readUInt32BE(20) == 0xffff0000
	});*/
};

/**
 * Reads the following from main audits:
 *
 * 	- B.1 09 Extra Balls
 *
 * @param next
 */
WPC.prototype._readMainAudits = function(next) {
	next(null, {
		extraBalls: WPC.prototype._readHexWithChecksum(this.ram, 0x18b3, 3)
	});
};

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
WPC.prototype._readStandardAudits = function(next) {
	next(null, {
		gamesStarted: WPC.prototype._readHexWithChecksum(this.ram, 0x1883, 3),
		gamesPlayed: WPC.prototype._readHexWithChecksum(this.ram, 0x1889, 3),
		playTime: WPC.prototype._readHexWithChecksum(this.ram, 0x18b9, 3) * 10000,
		runningTime: WPC.prototype._readHexWithChecksum(this.ram, 0x18bf, 3) * 60000,
		ballsPlayed: WPC.prototype._readHexWithChecksum(this.ram, 0x18c5, 3)
	});
};

/**
 * Reads all histogram data from:
 *
 *  - B.5 Histograms
 *
 * @param next
 */
WPC.prototype._readHistograms = function(next) {

	var that = this;
	var histoScores = {
		afm_ :   ['0M', '200M', '400M', '600M', '800M', '1B', '1.5B', '2B', '3B', '4B', '5B', '7B', '9B'],
		br_ :    ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '70M', '100M', '150M', '200M', '300M'],
		cc_ :    ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '60M', '80M', '100M', '150M', '200M'],
		cftbl_ : ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '70M', '100M', '150M', '200M', '300M'],
		cv_ :    ['0M', '1M', '2M', '3M', '4M', '5M', '10M', '20M', '30M', '40M', '100M', '150M', '200M'],
		drac_ :  ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '70M', '100M', '150M', '200M', '300M'],
		gw_ :    ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '70M', '100M', '150M', '200M', '300M'],
		i500_ :  ['0M', '40M', '60M', '80M', '100M', '150M', '250M', '400M', '600M', '1B', '1.5B', '2B', '3B'],
		ij_ :    ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '70M', '100M', '150M', '200M', '300M'],
		mb_ :    ['0M', '1M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '60M', '70M', '80M', '90M'],
		mm_ :    ['0M', '1M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '60M', '70M', '80M', '90M'],
		ss_ :    ['0K', '500K', '1M', '3M', '5M', '7M', '9M', '12M', '15M', '20M', '30M', '50M', '90M'],
		sttng_ : ['0M', '40M', '60M', '80M', '100M', '150M', '250M', '400M', '600M', '1B', '1.5B', '2B', '3B'],
		t2_ :    ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '70M', '100M', '150M', '200M', '300M'],
		taf_ :   ['0M', '2M', '5M', '10M', '20M', '30M', '40M', '50M', '70M', '100M', '150M', '200M', '300M'],
		tom_ :   ['0M', '20M', '50M', '100M', '250M', '500M', '600M', '700M', '800M', '900M', '1B', '1.25B', '1.5B'],
		totan_ : ['0K', '500K', '1M', '1.5M', '2M', '3M', '4M', '5M', '6M', '8M', '10M', '15M', '20M'],
		tz_ :    ['0M', '5M', '10M', '20M', '40M', '60M', '90M', '120M', '150M', '200M', '250M', '350M', '500M']
	};
	var audits = {};
	var readScoreHistogram = function(scores) {
		var histogram = [];
		for (var i = 0; i < scores.length; i++) {
			histogram.push({
				score: scores[i],
				num: WPC.prototype._readHexWithChecksum(that.ram, 0x191f + (i * 6), 3)
			});
			if (histogram[0].num === false) {
				histogram = false;
				break;
			}
		}
		audits.scoreHistogram = histogram;
	};

	var readTimeHistogram = function() {
		var durations = [ 0, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 900 ];
		var histogram = [];
		for (var i = 0; i < durations.length; i++) {
			histogram.push({
				duration: durations[i],
				num: WPC.prototype._readHexWithChecksum(that.ram, 0x196d + (i * 6), 3)
			});
			if (histogram[0].num === false) {
				histogram = false;
				break;
			}
		}
		audits.playtimeHistogram = histogram;
	};

	function is(prefix) {
		return that.rom.substr(0, prefix.length).toLowerCase() == prefix.toLowerCase();
	}

	_.each(histoScores, function(scores, prefix) {
		if (is(prefix)) {
			readScoreHistogram(scores);
		}
	});
	readTimeHistogram();

	next(null, audits);
};


/**
 * Reads n bytes from RAM into a number
 *
 * @param buf Buffer to read from
 * @param pos Start position
 * @param len Length to read
 * @returns {number}
 * @private
 */
WPC.prototype._readHex = function(buf, pos, len) {
	var num = 0;
	for (var i = 0; i < len; i++) {
		num += buf.readUInt8(pos + i) * Math.pow(256, len - i - 1);
	}
	return num;
};

/**
 * Reads n bytes from RAM into a number and verifies the checksum. On
 * failure, return false.
 *
 * @param buf Buffer to read from
 * @param pos Start position
 * @param len Length to read
 * @returns {number|false}
 * @private
 */
WPC.prototype._readHexWithChecksum = function(buf, pos, len) {
	var checksum = function(pos, len) {
		var c = 0;
		for (var i = 0; i < len; i++) {
			c += buf.readUInt8(pos + i);
		}
		return 255 - (c % 256);
	};
	var value = this._readHex(buf, pos, len);
	var valueCheck = buf.readUInt8(pos + len + 2);
	if (valueCheck == checksum(pos, 3)) {
		return value;
	} else {
		return false;
	}
};

module.exports = WPC;