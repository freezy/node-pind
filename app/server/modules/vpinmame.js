var fs = require('fs');
var exec = require('child_process').exec;
var util = require('util');
var async = require('async');
var config =  require('konphyg')(__dirname + '../../../config');
var settings = config('settings-mine');

/**
 * Returns highscores for a given ROM.
 * @param romname Name of the ROM
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} Parsed high scores.</li></ol>
 */
exports.getHighscore = function(romname, callback) {
	var binPath = fs.realpathSync(__dirname + '../../../../bin');
	exec(binPath + '/PINemHi.exe' + ' ' + romname + ".nv", { cwd: binPath }, function (error, stdout, stderr) {
		if (stdout.match(/^not supported rom/i)) {
			//callback('ROM is not supported by PINemHi.');
			callback();
			return;
		}
		if (error !== null) {
			console.log(error);
		} else {
			var m, regex, titles, blocks = stdout;
			var scores = {};

			// grand champ
			titles = [ 'grand champion', 'champion', 'greatest vampire hunter', 'highest ball score', 'mvp',
				'world record', 'highest arrests', 'dream master', 'ultimate gladiator', 'club champion',
				'five star general', 'super hero', 'the master', 'tee.d off leader', 'world champion',
				'master magician', 'psycho skier', 'river master' ];
			regex = new RegExp('(' + titles.join('|') + ')\\s+(\\d.?\\s+|#\\d\\s+)?([\\w\\s]{3,})\\s+([\\d\',]+)', 'im');
			if (m = regex.exec(blocks)) {
				blocks = blocks.replace(m[0], '');
				scores.grandChampion = { player: m[3].trim(), score: num(m[4]) };
			}

			// highest scores
			titles = [ 'high(est)? ?scores', 'standings', 'champion drinkers', 'all-stars', 'today.s hi-score',
				'top fruit throwers', 'high hoppers', 'hall of fame', 'valedictorians', 'cue ball wizards', 'top cops',
				'best hunters', 'dream warriors', 'top anglers', 'honorific gladiators', 'ace drivers', 'high rollers',
				'oscar winners', 'leader ?board', 'highest game to date', 'hero', 'street fighters', 'all stars',
				'silver sluggers', 'mario.s friends', 'explorers', 'best citizens', 'honor roll', 'top water sliders',
				'top marksmen', 'family members', 'top contenders', 'magicians', 'sultan.s court', 'high rollers',
				'marines', 'hot dogs', 'best rafters', 'the champions', 'premier warriors', 'top eight players',
				'bad girls . dudes', 'baddest cats', 'biggest guns', 'escape artists', 'greatest heroes'];
			regex = new RegExp('\\n(' + titles.join('|') + ')[\\s\\S]+?\\n\\r', 'i');
			if (m = regex.exec("\n" + blocks + "\n\r")) {
				scores.highest = [];
				blocks = blocks.replace(m[0].trim(), '');
				var block = m[0];
				var regex = new RegExp(/(\d).?\s([\w\s]{3})\s+([\d',]+)/gi);
				while (m = regex.exec(block)) {
					if (m[2].trim().length > 0) {
						scores.highest.push({ rank: m[1], player: m[2], score: num(m[3]) });
					}
				}
			}
			// jurassic park and starwars need special treatment (stwr_a14, jupk_513, tftc_303)
			if (m = blocks.match(/([\w\s\-]+#\d\s+[\w\s]{3}\s+[\d',]+\s+){4,}/m)) {
				blocks = blocks.replace(m[0].trim(), '');
				regex = new RegExp(/([\w\s\-]+)#(\d)\s+([\w\s]{3})\s+([\d',]+)/g);
				var block = m[0];
				var n = 0;
				while (m = regex.exec(block)) {
					// first is grand champion
					if (n == 0) {
						scores.grandChampion = { player: m[3], score: num(m[4]), title: tidy(m[1]) }
						scores.highest = [];
					} else {
						scores.highest.push({ player: m[3], score: num(m[4]), title: tidy(m[1]), rank: m[2]-1 });
					}
					n++;
				}
			}

			// buy-in scores
			titles = [ 'buy-in highest scores', 'buyin barflies', 'buy-in scores', 'buy-in highscores', 'officer.s club',
				'buyin copilots'];
			regex = new RegExp('\\n(' + titles.join('|') + ')[\\s\\S]+?\\n\\r', 'i');
			if (m = regex.exec("\n" + blocks + "\n\r")) {
				scores.buyin = [];
				blocks = blocks.replace(m[0].trim(), '');
				var block = m[0];
				var regex = new RegExp(/(\d).?\s(\w+)\s+([\d',]+)/gi);
				while (m = regex.exec(block)) {
					scores.buyin.push({ rank: m[1], player: m[2], score: num(m[3]) });
				}
			}

			// special titles
			var b = blocks.trim().split(/\n\r/);
			var blocks = function(block) {

				var m;
				var checks = [];

				function add(fct, regex, name) {
					checks.push({ fct: fct, regex: regex, name: name });
				}

				function is(prefix) {
					return romname.substr(0, prefix.length).toLowerCase() == prefix.toLowerCase();
				}

				if (is('abv')) { // abv106
					add(nameScore, 'Ace Winger');
					add(listRankNameScore, 'mach kings', 'Mach King');
					add(nameScore, 'Flyby King');
					add(listNameScore, 'loopsters', 'Loopster');
				}
				if (is('afm')) { // afm_113b
					add(nameInfo, 'Ruler of the Universe');
					add(nameDashInfo, 'Martian Champion');
				}
				if (is('agsocker')) { // agsocker
					add(listRankNameScore, 'Most Valuable Player');
				}
				if (is('apollo13')) { // apollo13
					add(nameTitle, 'Played 13-ball Multiball');
				}
				if (is('andretti')) { // andretti
					add(nameInfo, 'Lap Time Record');
				}
				if (is('bbb')) { // bbb109
					add(listName, 'big bang regulars', 'Big Bang Regular');
					add(listNameScore, 'underground elite', 'Underground Elite');
					add(listNameScore, 'weak kidney club', 'Weak Kidney Club Member');
				}
				if (is('bighurt')) { // bighurt
					add(infoEqualsScoreName, 'Sultan of Swat');
					add(infoEqualsScoreName, 'MVP');
					add(infoEqualsScoreName, 'Gold Glove');
					add(infoEqualsScoreName, 'Stolen Base King');
				}
				if (is('bop')) { // bop_l8
					add(listNameScore, 'billionaire club members', 'Billionaire Club Member');
				}
				if (is('br')) { // br_l4
					/* MOST SHIPS SUNK
					 * 2 BY SLL
					 */
					if (m = block.match(/most ships sunk\s+(\d+)\s+by\s+([\w\s]{3})/i)) {
						return { title: 'Most Ships Sunk', player: player(m[2]), score: num(m[1]) }
					}
				}
				if (is('bttf')) { // bttf_a27
					add(nameScore, 'Loop Back Champ');
				}
				if (is('carhop')) { // carhop
					add(nameOnly, 'Record Heat Wave');
				}
				if (is('congo')) { // congo_21
					add(nameInfo, 'Diamond Champion');
				}
				if (is('cv')) { // cv_14
					add(nameDashScore, 'Cannon Ball Champion');
					add(nameScore, 'Party Champion');
				}
				if (is('deadweap')) { // deadweap
					add(nameDashScore, 'Highest Arrests');
				}
				if (is('drac')) { // drac_l1
					add(nameScore, 'Loop Champion');
				}
				if (is('freddy')) { // freddy
					add(nameDashScore, 'Most Souls Saved');
				}
				if (is('ft')) { // ft_p4
					add(nameInfo, 'Biggest Liar');
					add(nameInfo, 'Top Boat Rocker');
				}
				if (is('gladiatr')) { // gladiatr
					add(nameOnly, 'Beast Slayer');
					add(nameOnly, 'Combo Master');
				}
				if (is('gw')) { // gw_l5
					add(nameDashInfo, 'Loop Champion');
				}
				if (is('jb')) { // jb_10r
					add(nameScore, 'Casino Run Champ');
				}
				if (is('lca')) {
					add(nameOnly, '5 of a kind', 'Five of a kind');
				}
				if (is('lotr')) { // lotr9
					add(nameDashInfo, 'Destroy Ring Champion');
				}
				if (is('mb')) { // mb_106b
					add(nameScore, 'Monster Bash Champion');
					add(nameScore, 'Mosh Multiball Champion');
					add(nameScore, 'monsters.rock champion', 'Monsters/Rock Champion');
				}
				if (is('mm')) { // mm_109c
					add(listRankNameInfo2, 'King of the Realm');
					add(nameDashInfo, 'Castle Champion');
					add(nameDashInfo, 'Joust Champion');
					add(nameDashInfo, 'Catapult Champion');
					add(nameDashInfo, 'Peasant Champion');
					add(nameDashInfo, 'Damsel Champion');
					add(nameDashInfo, 'Troll Champion');
					add(nameScore, 'Madness Champion');
				}
				if (is('nbaf')) { // nbaf_31
					add(nameInfo, 'Current M.V.P');
					/*
					 * NBA TEAM CHAMPIONS
					 * BLAZERS     TMK    51
					 * BUCKS       CJS    48
					 * BULLETS     ZAB    34
					 * BULLS       LED   136 3-RINGS
					 * CAVS        ROG    84 1-RING
					 * CELTICS     LFS   104 2-RINGS
					 * CLIPPERS    ASR    52
					 * ...
					 */
					if (m = block.match(/nba team champions([\s\S]+)/i)) {
						var b = m[1];
						var ret = [];
						var regex = new RegExp(/(\w+)\s+(\w+)\s+(.+)/g);
						while (m = regex.exec(b)) {
							ret.push({ title: 'NBA Team Champion', player: m[2], info: tidy(m[1]), info2: tidy(m[3])});
						}
						return ret;
					}
				}
				if (is('ngg')) { // ngg_p06
					add(nameScore, 'today.s high score', "Today's Highscore");
					add(nameScore, 'hole in one champion', 'Hole-in-one Champion');
				}
				if (is('opthund')) { // opthund
					add(nameOnly, 'Five Star General');
				}
				if (is('rescu911')) { // rescu911
					add(nameScore, 'Most Lives Saved');
				}
				if (is('sfight2')) { // sfight2
					add(nameOnly, 'The Master');
				}
				if (is('shaqattq')) { // shaqattq
					add(nameScore, 'most basket points by', 'Most Basket Points');
				}
				if (is('silvslug')) { // silvslug
					add(nameDashScore, 'Highest Runs to Date');
				}
				if (is('smb')) { // smb3
					add(nameOnly, 'Super Mario');
				}
				if (is('ss')) { // ss_15
					add(nameInfo, 'Spider Champion');
				}
				if (is('stargate')) { // stargate
					add(nameScore, 'high combos by', 'High Combos');
				}
				if (is('sttng')) { // sttng_s7
					/* STTNG ranking list types:
					 *     Grand Champion  0 or 1 Buy-Ins
					 *     Honor Roll      0 or 1 Buy-Ins
					 *     Officer's Club  More than 1 Buy-In
					 *     Q Continuum     Score of 10 Billion or more (Any Number Of Buy-Ins)
					 */
					add(listRankNameScore, 'Q Continuum');
				}
				if (is('surfnsaf')) { // surfnsaf
					add(nameDashScore, 'Rapids Record');
				}
				if (is('teedoff')) { // teedoff
					add(nameScore, 'the most holes in one', 'The Most Holes-In-One');
				}
				if (is('tfight')) { // tfight
					add(nameDashScore, 'Highest punches');
				}
				if (is('tz')) { // tz_92
					add(listRankNameScore, 'Lost in the Zone Champion');
				}
				if (is('vegas')) { // vegas
					add(nameOnly, 'Slot King');
				}
				if (is('waterwld')) { // waterwld
					add(infoEqualsScoreName, 'icthy freak', 'Itchy Freak');
				}
				if (is('wcsoccer')) { // wcsoccer
					add(nameOnly, 'World Champ');
					add(nameScore, 'you have the most goals.', 'Most Goals');
				}
				if (is('wd')) { // wd_12
					add(nameOnly, 'The Roof Champion');
					add(nameOnly, 'Midnight Champ');
				}
				if (is('ww')) { // ww_l5
					add(nameInfo, 'Insanity Record');
				}

				for (var i = 0; i < checks.length; i++) {
					var ret;
					if (ret = checks[i].fct(block, checks[i].regex, checks[i].name)) {
						return ret;
					}
				}

				return null;

			};
			scores.other = [];
			for (var i = 0; i < b.length; i++) {
				var block = blocks(b[i]);
				if (block) {
					if (Array.isArray(block)) {
						scores.other = scores.other.concat(block);
					} else {
						scores.other.push(block);
					}
				} else if (b[i].trim().length > 0) {

					console.log('\n' + romname + ': Unknown block: \n' + b[i] + '\n');
					callback(b[i]);
					return;
				}
			}

			scores.raw = stdout;

			callback(null, scores);
		}
	});
};

/**
 * Goes through all nvrams and verifies that everything could be parsed.
 */
exports.assertAll = function() {
	var skip = [ 'algar_l1', 'alienstr', 'alpok_b6', 'alpok_f6', 'alpok_l2', 'alpok_l6', 'amazonh', 'astannie',
		'barra_l1', 'beatclck' ];
	var files = fs.readdirSync(settings.vpinmame.path + '/nvram');
	var nvrams = [];
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		var nvram = file.substr(0, file.length - 3);
		if (file.substr(file.length - 3, file.length) == '.nv' && skip.indexOf(nvram) == -1) {
			nvrams.push(nvram);
		}
	}
	async.eachSeries(nvrams, function(nvram, callback) {
		exports.getHighscore(nvram, function(err, result) {
			if (!err) {
				if (result != null) {
					delete result.raw;
					console.log(util.inspect(result));
				}
			}
			callback(err, result);
		});
	}, function() {});
}



/**
 * Converts info text to the right case.
 */
function tidy(str) {
	return (' ' + str.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(\.\s+\w|^\s*\w|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\S*/ig, function(txt){
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	}) + ' ').replace(/\W(am|pm)\W/i, function(txt) {
			return txt.toUpperCase();
		}).trim();
}

/**
 * Strips separation chars from number.
 * @param str
 * @returns {*|String}
 */
function num(str) {
	return str.replace(/[',]/g, '');
}

function player(str) {
	return str.trim();
}


/**
 * Example:
 *
 *  RECORD HEAT WAVE
 *  TIF
 *
 * @param block
 * @param str
 * @param title
 * @returns {*}
 */
var nameOnly = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\w\\s]{3})', 'i'))) {
		return { title: title, player: player(m[1]) }
	}
	return false;
}

/**
 * Example:
 *
 *  FLYBY KING
 *  PWM    15
 *
 * @param block
 * @param str
 * @param title
 * @returns {*}
 */
var nameScore = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\w\\s]{3})\\s+([\\d\',]+)', 'i'))) {
		return { title: title, player: player(m[1]), score: num(m[2]) }
	}
	return false;
}

/**
 * Example:
 *  RULER OF THE UNIVERSE
 *  TEX
 *  INAUGURATED
 *  6 APR, 2012 7:36 PM
 *
 * @param block
 * @param str
 * @param title
 * @return {*}
 */
var nameInfo = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\w\\s]{3})\\s+(\\w+[\\s\\S]+)', 'i'))) {
		return { title: title, player: player(m[1]), info: tidy(m[2]) }
	}
	return false;
}

/**
 * Example:
 *
 *  MARTIAN CHAMPION
 *  LFS - 20
 *  MARTIANS DESTROYED
 *
 * @param block
 * @param str
 * @param title
 * @return {*}
 */
var nameDashInfo = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\w\\s]{3})\\s+-\\s+(\\w+[\\s\\S]+)', 'i'))) {
		return { title: title, player: player(m[1]), info: tidy(m[2]) }
	}
	return false;
};
/**
 * Example:
 *
 *  CANNON BALL CHAMPION
 *  TEX - 50
 *
 * @param block
 * @param str
 * @param title
 * @return {*}
 */
var nameDashScore = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\w\\s]{3})\\s+-\\s+([\\d\',]+)', 'i'))) {
		return { title: title, player: player(m[1]), score: num(m[2]) }
	}
	return false;
}
/**
 * Example:
 *
 *  SULTAN OF SWAT
 *  HIGH GRAND SLAMS TO DATE = 7
 *  HGD
 *
 * @param block
 * @param str
 * @param title
 * @return {*}
 */
var infoEqualsScoreName = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\w\\s]+)\\s*=\\s*([\\d\',]+)\\s+([\\w\\s]{3})', 'i'))) {
		return { title: title, player: player(m[3]), info: tidy(m[1]), score: num(m[2]) }
	}
	return false;
}

/**
 * Example:
 *
 *  JEK
 *  PLAYED 13-BALL MULTIBALL
 *
 * @param block
 * @param str
 * @param title
 * @returns {*}
 */
var nameTitle = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp('([\\w\\s]{3})\\s+' + str, 'i'))) {
		return { title: title, player: player(m[1]) }
	}
	return false;
}


/**
 * Example:
 *
 *  BIG BANG REGULARS
 *  SPK
 *  PFZ
 *  TON
 *  MNY
 *  BBB
 *
 * @param block
 * @param str
 * @param title
 * @returns {*}
 */
var listName = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\s\\S]+)', 'i'))) {
		var players = m[1].trim().split(/\s+/);
		var ret = [];
		for (var i = 0; i < players.length; i++) {
			ret.push({ title: title, player: player(players[i]) });
		}
		return ret;
	}
	return false;
}

/**
 * Example:
 *
 *  UNDERGROUND ELITE
 *  SPK    10
 *  PFZ     9
 *  TON     8
 *  MNY     7
 *  BBB     6
 *
 * @param block
 * @param str
 * @param title
 * @returns {*}
 */
var listNameScore = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\s\\S]+)', 'i'))) {
		var b = m[1];
		var ret = [];
		var regex = new RegExp(/([\w\s]{3})\s+([\d',]+)/g);
		while (m = regex.exec(b)) {
			ret.push({ title: title, player: player(m[1]), score: num(m[2]) });
		}
		return ret;
	}
	return false;
}

/**
 * Example:
 *
 *   MACH KINGS
 *   1) SAM    1,000,000,000
 *   2) KAT      825,000,000
 *   3) TND      650,000,000
 *   4) FML      475,000,000
 *   5) HUG      300,000,000
 *
 * @param block
 * @param str
 * @param title
 * @returns {*}
 */
var listRankNameScore = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\s\\S]+)', 'i'))) {
		var b = m[1];
		var ret = [];
		var regex = new RegExp(/(\d).?\s+([\w\s]{3})\s+([\d',]+)/g);
		while (m = regex.exec(b)) {
			ret.push({ title: title, rank: m[1], player: player(m[2]), score: num(m[3]) });
		}
		return ret;
	}
	return false;
}

/**
 * Info on 2 lines.
 *
 * Example:
 *
 *  KING OF THE REALM
 *  1) JIM
 *  CROWNED FOR THE 1st TIME
 *  29 SEP, 2010 7:14 PM
 *  2) KOP
 *  CROWNED FOR THE 1st TIME
 *  8 SEP, 2010 9:56 PM
 *
 * @param block
 * @param str
 * @param title
 * @return {*}
 */
var listRankNameInfo2 = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\s\\S]+)', 'i'))) {
		var b = m[1];
		var ret = [];
		var regex = new RegExp(/(\d).?\s+([\w\s]{3})\s+(.+[\n\r]+.+)/g);
		var i = 0;
		while (m = regex.exec(b)) {
			ret.push({ title: title, rank: m[1], player: player(m[2]), info: tidy(m[3]) });
			i++;
		}
		return i ? ret : false;
	}
	return false;
}
