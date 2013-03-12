var fs = require('fs');
var exec = require('child_process').exec;

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
			regex = new RegExp('(' + titles.join('|') + ')\\s+(\\d.?\\s+)?([\\w\\s]{3,})\\s+([\\d\',]+)', 'im');
			if (m = regex.exec(blocks)) {
				blocks = blocks.replace(m[0], '');
				scores.grandChampion = { player: m[3].trim(), score: m[4].replace(/[',]/g, '') };
			}

			// highest scores
			titles = [ 'high(est)? ?scores', 'standings', 'champion drinkers', 'all-stars', 'today.s hi-score',
				'top fruit throwers', 'high hoppers', 'hall of fame', 'valedictorians', 'cue ball wizards', 'top cops',
				'best hunters', 'dream warriors', 'top anglers', 'honorific gladiators', 'ace drivers', 'high rollers',
				'oscar winners', 'leader ?board', 'highest game to date', 'hero', 'street fighters', 'all stars',
				'silver sluggers', 'mario.s friends', 'explorers', 'best citizens', 'honor roll', 'top water sliders',
				'top marksmen', 'family members', 'top contenders', 'magicians', 'sultan.s court', 'high rollers',
				'marines', 'hot dogs', 'best rafters'];
			regex = new RegExp('\\n(' + titles.join('|') + ')[\\s\\S]+?\\n\\r', 'i');
			if (m = regex.exec("\n" + blocks + "\n\r")) {
				scores.highest = [];
				blocks = blocks.replace(m[0].trim(), '');
				var block = m[0];
				var regex = new RegExp(/(\d).?\s([\w\s]{3})\s+([\d',]+)/gi);
				while (m = regex.exec(block)) {
					scores.highest.push({ rank: m[1], player: m[2], score: m[3].replace(/[',]/g, '') });
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
						scores.grandChampion = { player: m[3], score: m[4].replace(/[',]/g, ''), title: tidy(m[1]) }
						scores.highest = [];
					} else {
						scores.highest.push({ player: m[3], score: m[4].replace(/[',]/g, ''), title: tidy(m[1]), rank: m[2]-1 });
					}
					n++;
				}
			}

			// buy-in scores
			titles = [ 'buy-in highest scores', 'buyin barflies', 'buy-in scores', 'buy-in highscores', 'officer.s club' ];
			regex = new RegExp('\\n(' + titles.join('|') + ')[\\s\\S]+?\\n\\r', 'i');
			if (m = regex.exec("\n" + blocks + "\n\r")) {
				scores.buyin = [];
				blocks = blocks.replace(m[0].trim(), '');
				var block = m[0];
				var regex = new RegExp(/(\d).?\s(\w+)\s+([\d',]+)/gi);
				while (m = regex.exec(block)) {
					scores.buyin.push({ rank: m[1], player: m[2], score: m[3].replace(/[',]/g, '') });
				}
			}

			// other titles
			var b = blocks.trim().split(/\n\r/);
			var others = function(block) {
				var m;
				// AFM
				if (m = block.match(/ruler of the universe\s+(\w+)\s+(\w+[\s\S]+)/i)) {
					return { title: 'Ruler of the Universe', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/martian champion\s+(\w+)\s+-\s+(\w+[\s\S]+)/i)) {
					return { title: 'Martian Champion', player: m[1], info: tidy(m[2]) }
				}

				// andretti
				if (m = block.match(/lap time record\s+(\w+)\s+([\d',\.]+)/i)) {
					return { title: 'Lap Time Record', player: m[1], score: m[2].replace(/[',\.]/g, '') }
				}

				// bbb
				var titleOnly = function(block, str, title) {
					if (m = block.match(new RegExp(str + '\\s+([\\s\\S]+)', 'i'))) {
						var players = m[1].trim().split(/\s+/);
						var ret = [];
						for (var i = 0; i < players.length; i++) {
							ret.push({ title: title, player: players[i] });
						}
						return ret;
					}
					return false;
				}
				var titleScore = function(block, str, title) {
					if (m = block.match(new RegExp(str + '\\s+([\\s\\S]+)', 'i'))) {
						var players = m[1].trim().split(/\s+/);
						var ret = [];
						for (var i = 0; i < players.length; i += 2) {
							ret.push({ title: title, player: players[i], score: players[i+1].replace(/[',]/g, '') });
						}
						return ret;
					}
					return false;
				}
				var ret;
				if (ret = titleOnly(block, 'big bang regulars', 'Big Bang Regular')) {
					return ret;
				}
				if (ret = titleScore(block, 'underground elite', 'Underground Elite')) {
					return ret;
				}
				if (ret = titleScore(block, 'weak kidney club', 'Weak Kidney Club Member')) {
					return ret;
				}

				// bighurt
				if (m = block.match(/sultan of swat\s+([\w\s]+)\s*=\s*(\d+)\s+(\w+)/i)) {
					return { title: 'Sultan of Swat', player: m[3], info: tidy(m[1]), score: m[2] }
				}
				if (m = block.match(/mvp\s+([\w\s]+)\s*=\s*(\d+)\s+(\w+)/i)) {
					return { title: 'MVP', player: m[3], info: tidy(m[1]), score: m[2] }
				}
				if (m = block.match(/gold glove\s+([\w\s]+)\s*=\s*(\d+)\s+(\w+)/i)) {
					return { title: 'Gold Glove', player: m[3], info: tidy(m[1]), score: m[2] }
				}
				if (m = block.match(/stolen base king\s+([\w\s]+)\s*=\s*(\d+)\s+(\w+)/i)) {
					return { title: 'Stolen Base King', player: m[3], info: tidy(m[1]), score: m[2] }
				}

				// bop
				if (ret = titleScore(block, 'billionaire club members', 'Billionaire Club Member')) {
					return ret;
				}

				// br
				if (m = block.match(/most ships sunk\s+(\d+)\s+by\s+(\w+)/i)) {
					return { title: 'Most ships sunk', player: m[2], score: m[1] }
				}

				// bttf
				if (m = block.match(/loop back champ\s+(\w+)\s+(\d+)/i)) {
					return { title: 'Most ships sunk', player: m[1], score: m[2] }
				}

				// carhop
				if (m = block.match(/record heat wave\s+(\w+)/i)) {
					return { title: 'Record Heat Wave', player: m[1] }
				}

				// congo
				if (m = block.match(/diamond champion\s+(\w[^\d]+)\s+(.*)/i)) {
					return { title: 'Diamond Champion', player: m[1].trim(), info: tidy(m[2]) }
				}

				// cv
				if (m = block.match(/cannon ball champion\s+(\w+)\s+-\s+(\d+)/i)) {
					return { title: 'Cannon Ball Champion', player: m[1].trim(), score: m[2] }
				}
				if (m = block.match(/party champion\s+(\w+)\s+([\d',]+)/i)) {
					return { title: 'Party Champion', player: m[1].trim(), score: m[2].replace(/[,']/g, '') }
				}

				// deadweap
				if (m = block.match(/highest arrests\s+(\w+)\s+-\s+(\d+)/i)) {
					return { title: 'Highest Arrests', player: m[1].trim(), score: m[2] }
				}

				// drac
				if (m = block.match(/loop champion\s+(\w+)\s+(\d+)/i)) {
					return { title: 'Loop Champion', player: m[1].trim(), score: m[2] }
				}

				// freddy
				if (m = block.match(/dream master\s+.(\d)\s+(\w+)\s+([\d,']+)/i)) {
					return { title: 'Dream Master', player: m[2].trim(), rank: m[1], score: m[3].replace(/[',]/g, '') }
				}
				if (m = block.match(/most souls saved\s+(\w+)\s+-\s+(\d+)/i)) {
					return { title: 'Most Souls Saved', player: m[1].trim(), score: m[2] }
				}

				// ft
				if (m = block.match(/biggest liar\s+(\w+)\s+(.*)/i)) {
					return { title: 'Biggest Liar', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/top boat rocker\s+(\w+)\s+(.*)/i)) {
					return { title: 'Top Boat Rocker', player: m[1], info: tidy(m[2]) }
				}

				// gladiatr
				if (m = block.match(/beast slayer\s+(\w+)/i)) {
					return { title: 'Beast Slayer', player: m[1] }
				}
				if (m = block.match(/combo master\s+(\w+)/i)) {
					return { title: 'Combo Master', player: m[1] }
				}

				// gw
				if (m = block.match(/loop champion\s+(\w+)\s+-\s+(.+)/i)) {
					return { title: 'Loop Champion', player: m[1], info: tidy(m[2]) }
				}

				// jb
				if (m = block.match(/casino run champ\s+(\w+)\s+([\d,']+)/i)) {
					return { title: 'Casino Run Champ', player: m[1], score: m[2].replace(/[',]/g, '') }
				}

				// lca
				if (m = block.match(/5 of a kind\s+(\w+)/i)) {
					return { title: 'Five of a kind', player: m[1] }
				}

				// lotr
				if (m = block.match(/destroy ring champion\s+(\w+)\s+-\s+([\d\:\.]+)/i)) {
					return { title: 'Destroy Ring Champion', player: m[1], info: m[2] }
				}

				// mb
				if (m = block.match(/monster bash champion\s+([\w\s]{3,})\s+([\d',]+)/i)) {
					return { title: 'Monster Bash Champion', player: m[1].trim(), info: m[2].replace(/[',]/g, '') }
				}
				if (m = block.match(/monsters.rock champion\s+([\w\s]{3,})\s+([\d',]+)/i)) {
					return { title: 'Monsters/Rock Champion', player: m[1].trim(), info: m[2].replace(/[',]/g, '') }
				}
				if (m = block.match(/mosh multiball champion\s+([\w\s]{3,})\s+([\d',]+)/i)) {
					return { title: 'Mosh Multiball Champion', player: m[1].trim(), info: m[2].replace(/[',]/g, '') }
				}

				// mm
				if (m = block.match(/king of the realm\s+1.\s+(\w+)\s+(\w+[\s\S]+)/i)) {
					return { title: 'King of the Realm', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/castle champion\s+(\w+)\s+-\s+(\w+[\s\S]+)/i)) {
					return { title: 'Castle Champion', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/joust champion\s+(\w+)\s+-\s+(\w+[\s\S]+)/i)) {
					return { title: 'Joust Champion', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/catapult champion\s+(\w+)\s+-\s+(\w+[\s\S]+)/i)) {
					return { title: 'Catapult Champion', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/peasant champion\s+(\w+)\s+-\s+(\w+[\s\S]+)/i)) {
					return { title: 'Peasant Champion', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/damsel champion\s+(\w+)\s+-\s+(\w+[\s\S]+)/i)) {
					return { title: 'Damsel Champion', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/troll champion\s+(\w+)\s+-\s+(\w+[\s\S]+)/i)) {
					return { title: 'Troll Champion', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/madness champion\s+(\w+)\s+([\d',]+)/i)) {
					return { title: 'Madness Champion', player: m[1], score: m[2].replace(/[',]/g, '') }
				}

				// nbaf_31
				if (m = block.match(/current m\.v\.p\s+(\w+)\s+([^\s].+)/i)) {
					return { title: 'Current M.V.P.', player: m[1], info: tidy(m[2]) }
				}
				if (m = block.match(/nba team champions([\s\S]+)/i)) {
					blocks = blocks.replace(m[0].trim(), '');
					var b = m[1];
					var ret = [];
					var regex = new RegExp(/(\w+)\s+(\w+)\s+(.+)/g);
					while (m = regex.exec(b)) {
						ret.push({ title: 'NBA Team Champion', player: m[2], info: tidy(m[1]), info2: tidy(m[3])});
					}
					return ret;
				}

				// ngg
				if (m = block.match(/today.s high score\s+(\w+)\s+([\d',]+)/i)) {
					return { title: "Today's Highscore", player: m[1], score: m[2].replace(/[',]/g, '') }
				}
				if (m = block.match(/hole in one champion\s+(\w+)\s+([\d',]+)/i)) {
					return { title: 'Hole-in-one Champion', player: m[1], score: m[2].replace(/[',]/g, '') }
				}

				// opthund
				if (m = block.match(/five star general\s+(\w+)/i)) {
					return { title: 'Five Star General', player: m[1] }
				}

				// rescu911
				if (m = block.match(/most lives saved\s+(\w+)\s+([\d',]+)/i)) {
					return { title: 'Most Lives Saved', player: m[1], score: m[2].replace(/[',]/g, '') }
				}

				// sfight2
				if (m = block.match(/the master\s+(\w+)/i)) {
					return { title: 'The Master', player: m[1] }
				}

				// shaqattq
				if (m = block.match(/most basket points by\s+(\w+)\s+(\d+)/i)) {
					return { title: 'Most Basket Points', player: m[1], score: m[2] }
				}

				// silvslug
				if (m = block.match(/highest runs to date\s+(\w+)\s+-\s+(\d+)/i)) {
					return { title: 'Highest Runs to Date', player: m[1], score: m[2] }
				}

				// smb
				if (m = block.match(/super mario\s+(\w+)/i)) {
					return { title: 'Super Mario', player: m[1] }
				}

				// ss_15
				if (m = block.match(/spider champion\s+(\w+)\s+(.+)/i)) {
					return { title: 'Spider Champion', player: m[1], info: tidy(m[2]) }
				}

				// stargate
				if (m = block.match(/high combos by\s+(\w+)\s+(\d+)/i)) {
					return { title: 'High Combos', player: m[1], score: m[2] }
				}

				// sttng_s7
				// 		Grand Champion  0 or 1 Buy-Ins
				// 		Honor Roll      0 or 1 Buy-Ins
				// 		Officer's Club  More than 1 Buy-In
				// 		Q Continuum     Score of 10 Billion or more (Any Number Of Buy-Ins)
				var rankNameScore = function(block, str, title) {
					if (m = block.match(new RegExp(str + '\\s+([\\s\\S]+)', 'i'))) {
						//blocks = blocks.replace(m[0].trim(), '');
						var b = m[1];
						var ret = [];
						var regex = new RegExp(/(\d).\s+(\w+)\s+([\d',]+)/g);
						while (m = regex.exec(b)) {
							ret.push({ title: title, rank: m[1], player: m[2], score: m[3].replace(/[',]/g, '') });
						}
						return ret;
					}
					return false;
				}
				if (ret = rankNameScore(block, 'q continuum', 'Q Continuum')) {
					return ret;
				}

				// surfnsaf
				if (m = block.match(/rapids record\s+(\w+)\s+-\s+(\d+)/i)) {
					return { title: 'Rapids Record', player: m[1], score: m[2] }
				}

				// teedoff
				if (m = block.match(/the most holes in one\s+(\w+)\s+(\d+)/i)) {
					return { title: 'The Most Holes-In-One', player: m[1], score: m[2] }
				}

				// tfight
				if (m = block.match(/highest punches\s+(\w+)\s+-\s+(\d+)/i)) {
					return { title: 'Highest punches', player: m[1], score: m[2] }
				}

				// tz_92
				if (ret = rankNameScore(block, 'lost in the zone champion', 'Lost in the Zone Champion')) {
					return ret;
				}

				// vegas
				if (m = block.match(/slot king\s+(\w+)/i)) {
					return { title: 'Slot King', player: m[1] }
				}

				// waterwld
				if (m = block.match(/icthy freak\s+([\w\s]+)=\s+(\d+)\s+(\w+)/i)) {
					return { title: 'Itchy Freak', player: m[3], score: m[2], info: tidy(m[1]) }
				}

				// wcsoccer
				if (m = block.match(/world champ\s+(\w+)/i)) {
					return { title: 'World Champ', player: m[1] }
				}
				if (m = block.match(/you have the most goals.\s+(\w+)\s+(\d+)/i)) {
					return { title: 'Most Goals', player: m[1], score: m[2] }
				}

				// wd_12
				if (m = block.match(/the roof champion\s+(\w+)/i)) {
					return { title: 'The Roof Champion', player: m[1] }
				}
				if (m = block.match(/midnight champ\s+(\w+)/i)) {
					return { title: 'Midnight Champ', player: m[1] }
				}

				// ww_l5
				if (m = block.match(/insanity record\s+(\w+)\s+(.+)/i)) {
					return { title: 'Insanity Record', player: m[1], info: tidy(m[2]) }
				}

				return null;

			};
			scores.other = [];
			for (var i = 0; i < b.length; i++) {
				var other = others(b[i]);
				if (other) {
					if (Array.isArray(other)) {
						scores.other = scores.other.concat(other);
					} else {
						scores.other.push(other);
					}
				} else if (b[i].trim().length > 0) {

					console.log(romname + ': Could not match "other" block: \n' + b[i]);
					callback(b[i]);
					return;
				}
			}

			scores.raw = stdout;

			callback(null, scores);
		}
	});
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
