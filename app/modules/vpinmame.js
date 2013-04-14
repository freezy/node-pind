var fs = require('fs');
var exec = require('child_process').exec;
var util = require('util');
var async = require('async');
var schema = require('../model/schema');
var settings = require('../../config/settings-mine');

/**
 * Updates high scores from .nv RAM files.
 *
 * Loops through available tables and matches available users. To database
 * only goes when both are matched.
 *
 * @param callback Function to execute after completion, invoked with one argument:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
exports.fetchHighscores = function(callback) {
	var now = new Date();

	// called when there is a match between user and table
	var updateHighscore = function(hiscore, callback) {
		var where = { where: { type: hiscore.type, tableId: hiscore.table.id }};
		switch (hiscore.type) {
			case 'champ':
				break;
			case 'hiscore':
				where.where.rank = hiscore.rank;
				break;
			case 'special':
				where.where.title = hiscore.title;
				break;
		}
		// check if there's already an entry for type and table
		schema.Hiscore.find(where).success(function(row) {

			var points = function(hiscore) {
				switch (hiscore.type) {
					case 'champ':
						return 5;
					case 'hiscore':
						return 5 - hiscore.rank;
					case 'special':
						return 2;
				}
			}

			// if not, add new entry
			if (!row) {
				//console.log('No current entry found, adding new highscore.');
				schema.Hiscore.create({
					type: hiscore.type,
					score: hiscore.score,
					rank: hiscore.rank,
					title: hiscore.title,
					info: hiscore.info,
					points: points(hiscore),
					createdAt: now,
					updatedAt: now
				}).success(function(row) {
					row.setTable(hiscore.table).success(function(row) {
						row.setUser(hiscore.user).success(function(row) {
							callback(null, row);
						}).error(callback);
					}).error(callback);
				}).error(callback);

			// if so, update entry
			} else {
				//console.log('Found entry %s, updating', row.id);
				row.updateAttributes({
					score: hiscore.score,
					info: hiscore.info,
					points: points(hiscore),
					updatedAt: now
				}).success(function(row) {
					row.setUser(hiscore.user).success(function(row) {
						callback(null, row);
					}).error(callback);
				}).error(callback);
			}
		}).error(callback);
	};

	// fetch all VP table and store them into a dictionary
	schema.Table.all({ where: '`platform` = "VP" AND `rom` IS NOT NULL' }).success(function(rows) {
		var roms = [];
		var tables = {};
		// only retrieve roms that actually have an .nv file.
		for (var i = 0; i < rows.length; i++) {
			if (fs.existsSync(settings.vpinmame.path + '/nvram/' + rows[i].rom + '.nv')) {
				roms.push(rows[i].rom);
				tables[rows[i].rom] = rows[i];
				//break;
			}
		}
		// cache users to avoid re-quering
		schema.User.all().success(function(rows) {
			var users = {};
			for (var i = 0; i < rows.length; i++) {
				users[tr(rows[i].user)] = rows[i];
			}

			// for every rom, get high scores and try to match against the 2 dictionaries
			async.eachSeries(roms, function(rom, next) {
				exports.getHighscore(rom, function(err, hiscore) {
					if (err || !hiscore) {
						console.log('[%s] Error: %s', rom, err ? err : 'Unsupported ROM.');
						next();
					} else {
						var hiscores = [];

						// grand champion
						if (hiscore.grandChampion && users[tr(hiscore.grandChampion.player)]) {
							console.log('[%s] Matched grand champion: %s (%s)', rom, hiscore.grandChampion.player, hiscore.grandChampion.score);
							hiscores.push({
								type: 'champ',
								score: hiscore.grandChampion.score,
								table: tables[rom],
								user: users[tr(hiscore.grandChampion.player)]
							});
						}

						// regular high scores
						if (hiscore.highest) {
							for (var i = 0; i < hiscore.highest.length; i++) {
								var hs = hiscore.highest[i];
								if (users[tr(hs.player)]) {
									console.log('[%s] Matched high score %s: %s (%s)', rom, hs.rank, hs.player, hs.score);
									hiscores.push({
										type: 'hiscore',
										score: hs.score,
										rank: hs.rank,
										table: tables[rom],
										user: users[tr(hs.player)]
									});
								}
							}
						}

						// special titles
						if (hiscore.other) {
							for (var i = 0; i < hiscore.other.length; i++) {
								var hs = hiscore.other[i];
								if (users[tr(hs.player)]) {
									console.log('[%s] Matched %s: %s', rom, hs.title, hs.player);
									hiscores.push({
										type: 'special',
										title: hs.title,
										info: hs.info,
										score: hs.score,
										rank: hs.rank,
										table: tables[rom],
										user: users[tr(hs.player)]
									});
								}
							}
						}

						// now we have all high scores for this table, update them in the db
						async.eachSeries(hiscores, updateHighscore, next);
					}
				});
			}, callback);

		}).error(function(err) {
			throw Error(err);
		});

	}).error(function(err) {
		throw Error(err);
	});
}

/**
 * Creates pinemhi.ini with the correct parameters.
 */
exports.init = function() {
	var pinemhiConfigPath = binPath() + '\\pinemhi.ini';
	var pinemhiConfig = '[paths]\r\n';
	pinemhiConfig += 'VP=' + fs.realpathSync(settings.vpinmame.path + '/nvram') + '\\\r\n';
	pinemhiConfig += 'FP=' + fs.realpathSync(settings.futurepinball.path + '/fpRAM') + '\\\r\n';
	fs.writeFileSync(pinemhiConfigPath, pinemhiConfig);
};

/**
 * Returns highscores for a given ROM.
 * @param romname Name of the ROM
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} Parsed high scores.</li></ol>
 */
exports.getHighscore = function(romname, callback) {
	var path = binPath();
	exec(path + '/PINemHi.exe' + ' ' + romname + ".nv", { cwd: path }, function (error, stdout, stderr) {
		if (stdout.match(/^not supported rom/i)) {
			//callback('ROM is not supported by PINemHi.');
			return callback();
		}
		if (stdout.match(/^no such file/i)) {
			console.log(stdout);
			return callback('PINemHi could not find the .nv file. Check your paths.');
		}
		if (error !== null) {
			console.log(error);
		} else {
			var m, regex, titles, blocks = stdout;
			var scores = {};

			function is(prefix) {
				return romname.substr(0, prefix.length).toLowerCase() == prefix.toLowerCase();
			}

			// grand champ
			titles = [ 'grand champion', 'champion', 'greatest vampire hunter', 'highest ball score', 'mvp',
				'world record', 'highest arrests', 'dream master', 'ultimate gladiator', 'club champion',
				'five star general', 'super hero', 'the master', 'tee.d off leader', 'world champion',
				'master magician', 'psycho skier', 'river master', 'welt rekord', 'greatest time lord',
				'regular game\\s+grand champion', 'boss of bosses', 'high score', 'most scored',
				'top cops\\s+commander', 'the best dude', 'top spy', 'hippest shooter' ];

			regex = new RegExp('^(' + titles.join('|') + ')\\s+(\\d.?\\s+|#\\d\\s+)?([\\w\\s]{3})\\s+(\\$\\s+)?([\\d\',]+)', 'im');
			if (m = regex.exec(blocks)) {
				blocks = blocks.replace(m[0], '');
				scores.grandChampion = { player: m[3].trim(), score: num(m[5]) };
			}

			// highest scores
			titles = [ 'high(est)? ?scores', 'standings', 'champion drinkers', 'all-stars', 'today.s hi-score',
				'top fruit throwers', 'high hoppers', '(creature feature\\s+)?hall of fame', 'valedictorians',
				'cue ball wizards', 'top cops', 'best hunters', 'dream warriors', 'top anglers', 'honorific gladiators',
				'ace drivers', 'high rollers', 'oscar winners', 'leader ?board', 'highest game to date', 'hero',
				'street fighters', 'all stars', 'silver sluggers', 'mario.s friends', 'explorers', 'best citizens',
				'top water sliders', 'top marksmen', 'family members', 'top contenders', 'magicians',
				'sultan.s court', 'high rollers', 'marines', 'hot dogs', 'best rafters', 'the champions',
				'premier warriors', 'top eight players', 'bad girls . dudes', 'baddest cats', 'biggest guns',
				'escape artists', 'greatest heroes', 'groesste helden', 'bone busters', 'top guns', 'top hustlers',
				'dark knight', 'card sharks', 'best time lords', 'movers and shakers', 'conquerors', 'super stars',
				'mad scientists', 'squadron leaders', 'hollywood.s finest', 'premier shooters', 'hot shooters',
				'top drivers', 'regular game\\s+high scores', 'other kingpins', 'best pilots', 'today.s top 3',
				'hi ?scores', 'next highest', 'power magicians', '8 ball sharks', 'ships crew', 'top commandos',
				'robo.warriors', 'hot rockers', 'top jetters', 'super raser', 'all time highest scores',
				'under.achievers', 'party animals', 'spy masters', 'best jedi.s', 'top wrestlers', 'best drivers',
				'top dudes', 'teleport crew', 'gridiron kings', 'the victors', 'best agents' ];
			if (is('sttng')) {
				titles.push('honor roll');
			}
			regex = new RegExp('\\n(' + titles.join('|') + ')[\\s\\S]+?\\n\\r', 'i');
			if (m = regex.exec("\n" + blocks + "\n\r")) {
				scores.highest = [];
				blocks = blocks.replace(m[0].trim(), '');
				var block = m[0];
				var regex = new RegExp(/#?(\d+).?\s([\w\s+]{3})\s+([\d',]+)/gi);
				while (m = regex.exec(block)) {
					if (m[2].trim().length > 0) {
						scores.highest.push({ rank: m[1], player: player(m[2]), score: num(m[3]) });
					}
				}
			}
			// jurassic park, starwars and others need special treatment
			if (is('stwr') || is('jupk') || is('tftc') || is('robo') || is('tmnt') || is('trek') || is('wwfr')
				|| is('gnr') || is('hook') || is('lah') || is('lw3') || is('rab') || is('torp')) {
				if (m = blocks.match(/([\w\s\-\.']+(#\d|\d.)\s+[\w\s+]{3}\s+[\d',]+\s+){4,}/m)) {
					blocks = blocks.replace(m[0].trim(), '');
					regex = new RegExp(/([\w\s\-\.']+)#?(\d)\)?\s+([\w\s+]{3})\s+([\d',]+)/g);
					var block = m[0];
					var n = 0;
					while (m = regex.exec(block)) {
						// first is grand champion
						if (n == 0) {
							scores.grandChampion = { player: player(m[3]), score: num(m[4]), title: tidy(m[1]) }
							scores.highest = [];
						} else {
							scores.highest.push({ player: player(m[3]), score: num(m[4]), title: tidy(m[1]), rank: m[2]-1 });
						}
						n++;
					}
				}
			}

			// wrldtou2 needs yet a different treatment
			if (is('wrldto')) {
				if (m = blocks.match(/([\w\s\-\.]+\s+[\w\s+]{3}\s+[\d',]+\s+){4,}/m)) {
					blocks = blocks.replace(m[0].trim(), '');
					regex = new RegExp(/([\w\s\-\.]+)\s{2,}([\w\s+]{3})\s{2,}([\d',]+)/g);
					var block = m[0];
					var n = 0;
					while (m = regex.exec(block)) {
						// first is grand champion
						if (n == 0) {
							scores.grandChampion = { player: player(m[2]), score: num(m[3]), title: tidy(m[1]) }
							scores.highest = [];
						} else {
							scores.highest.push({ player: player(m[2]), score: num(m[3]), title: tidy(m[1]), rank: n+1 });
						}
						n++;
					}
				}
			}


			// buy-in scores
			titles = [ 'buy-in highest scores', 'buyin barflies', 'buy-in scores', 'buyin scores', 'buy-in highscores',
				'officer.s club', 'buyin copilots', 'buy in sharks', 'buyin super stars', 'super game\\s+high scores',
				'buyin bosses', 'buy-in magicians', '9 ball sharks' ];

			regex = new RegExp('\\n(' + titles.join('|') + ')[\\s\\S]+?\\n\\r', 'i');
			if (m = regex.exec("\n" + blocks + "\n\r")) {
				scores.buyin = [];
				blocks = blocks.replace(m[0].trim(), '');
				var block = m[0];
				var regex = new RegExp(/(\d+).?\s(\w+)\s+([\d',]+)/gi);
				while (m = regex.exec(block)) {
					scores.buyin.push({ rank: m[1], player: player(m[2]), score: num(m[3]) });
				}
			}


			// global data (non-player related)
			function global(score) {
				if (!scores.global) {
					scores.global = [];
				}
				scores.global.push(score);
			}
			if (m = blocks.match(/highest score\s+([\d',]+)/i)) {
				global({ title: 'Highest Score', score: num(m[1]) });
				blocks = blocks.replace(m[0].trim(), '');
			}
			// pz_f4
			if (m = blocks.match(/big bang\s+([\d',]+)/i)) {
				global({ title: 'Big Bang', score: num(m[1]) });
				blocks = blocks.replace(m[0].trim(), '');
			}


			// special titles
			var b = blocks.trim().split(/\n\r/);
			var blocks = function(block) {

				var m;
				var checks = [];

				function add(fct, regex, name) {
					checks.push({ fct: fct, regex: regex, name: name });
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
				if (is('agsoccer')) { // agsoccer
					add(listRankNameScore, 'Most Valuable Player');
				}
				if (is('apollo13')) { // apollo13
					add(nameTitle, 'Played 13-ball Multiball');
				}
				if (is('andrett')) { // andretti
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
				if (is('bk2k')) { // bk2k_l4
					add(nameInfo, 'Loop Champion');
				}
				if (is('bop')) { // bop_l8
					add(listNameScore, 'billionaire club members', 'Billionaire Club Member');
				}
				if (is('br')) { // br_l4
					/* MOST SHIPS SUNK
					 * 2 BY SLL
					 */
					if (m = block.match(/most ships sunk\s+(\d+)\s+by\s+([\w\s+]{3})/i)) {
						return { title: 'Most Ships Sunk', player: player(m[2]), score: num(m[1]) }
					}
				}
				if (is('bsv')) { // bsv103
					add(listRankNameScore, 'cutthroat champions', 'Cutthroat Champion');
				}
				if (is('bttf')) { // bttf_a27
					add(nameScore, 'Loop Back Champ');
					add(listRankNameScore, 'tages rekord', 'Tagesrekord');
				}
				if (is('carhop')) { // carhop
					add(nameOnly, 'Record Heat Wave');
				}
				if (is('congo')) { // congo_21
					add(nameInfo, 'Diamond Champion');
				}
				if (is('ckpt')) { // ckpt_a17
					add(nameScore, 'Loop Record');
					add(nameInfo, 'Speed Record');
				}
				if (is('corv')) { // corv_21
					add(nameOnly, 'Future Car Champ');
					add(nameInfo, 'World Speed Record');
					add(nameInfo, 'Cornering Record');
				}
				if (is('cp')) { // cp_15
					add(nameInfo, 'Pub Champion');
					add(nameInfo, 'Jump Rope Champion');
					add(nameInfo, 'Speed Bag Champion');
				}
				if (is('cv')) { // cv_14
					add(nameDashScore, 'Cannon Ball Champion');
					add(nameScore, 'Party Champion');
				}
				if (is('deadweap')) { // deadweap
					add(nameDashScore, 'Highest Arrests');
				}
				if (is('dh')) { // dh_lx2
					add(nameOnly, 'Crime Wave Champ');
				}
				if (is('dm')) { // dm_h5
					add(nameScore, 'Demolition Time Champion');
				}
				if (is('drac')) { // drac_l1
					add(nameScore, 'Loop Champion');
				}
				if (is('dw')) { // dw_l1
					add(nameScore, 'Loop Champion');
					add(nameScore, 'Highest Davros Multiball Wave');
				}
				if (is('freddy')) { // freddy
					add(nameDashScore, 'Most Souls Saved');
				}
				if (is('fs')) { // fs_lx2
					add(nameScore, 'Top Bowler');
				}
				if (is('ft')) { // ft_p4
					add(nameInfo, 'Biggest Liar');
					add(nameInfo, 'Top Boat Rocker');
				}
				if (is('gladiatr')) { // gladiatr
					add(nameOnly, 'Beast Slayer');
					add(nameOnly, 'Combo Master');
				}
				if (is('gldneye')) { // gldneye
					add(nameOnly, 'Satellite Jackpot');
				}
				if (is('godzilla')) { // godzilla
					add(listRankName, '5 multiballs champs', 'Multiball Champ');
				}
				if (is('gw')) { // gw_l5
					add(nameDashInfo, 'Loop Champion');
				}
				if (is('hoops')) { // hoops
					add(nameDashInfo, 'High Basket Points');
				}
				if (is('hurr')) { // hurr_l2
					add(nameOnly, 'Clown Time Record');
				}
				if (is('i500')) { // i500_11b
					add(nameInfo, 'Pit Stop Record');
					add(nameScore, 'Buyin Champion');
				}
				if (is('id4')) { // id4
					add(nameOnly, 'ID4 Super Jackpot');
				}
				if (is('jb')) { // jb_10r
					add(nameScore, 'Casino Run Champ');
				}
				if (is('jd')) { // jd_l6
					add(nameScore, 'super game\\s+grand champion', 'Super Game Grand Champion');
				}
				if (is('jm')) { // jm_12b
					add(nameScore, 'Cyberpunk');
					add(listRankNameScore, 'masters of powerdown', 'Master of Powerdown');
				}
				if (is('jp')) { // jplstw20
					add(nameDashScore, 'Site-B Champ');
				}
				if (is('lca')) {
					add(nameOnly, '5 of a kind', 'Five of a kind');
				}
				if (is('lostspc')) { // lostspc
					add(nameOnly, '3 Multiballs in 1 Ball');
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
					add(nameDashInfo, 'Troll Avenger');
					add(nameScore, 'Madness Champion');
					add(nameScore, 'Master of Madness');
				}
				if (is('mnfb')) { // mnfb_c27
					add(nameScore, 'Loop Record');
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
				if (is('play')) { // play203
					add(nameOnly, 'Playboy Champion');
				}
				if (is('pmv')) { // pmv112
					add(listName, 'members of the cabal', 'Member of the Cabal');
				}
				if (is('pop')) { // pop_lx5
					add(nameInfo, 'Loop Champion');
				}
				if (is('rescu911')) { // rescu911
					add(nameScore, 'Most Lives Saved');
				}
				if (is('robo')) { // robo_a34
					add(nameInfo, 'Jump Master');
				}
				if (is('rs')) { // rs_l6
					add(listRankNameScore, 'today.s highest scores', "Today's highest score");
				}
				if (is('sc')) { // sc_14
					add(listRankNameScore, 'Assault Masters');
					add(nameScore, 'Assault Champion');
				}
				if (is('sfight2')) { // sfight2
					add(nameOnly, 'The Master');
				}
				if (is('shaqatt')) { // shaqattq
					add(nameScore, 'most basket points by', 'Most Basket Points');
				}
				if (is('shrky')) { // shrky207
					add(nameOnly, 'Prize Money Millionaire');
				}
				if (is('silvslug')) { // silvslug
					add(nameDashScore, 'Highest Runs to Date');
				}
				if (is('simp')) { // simp_a20
					add(nameScore, 'Loop Back Champ');
				}
				if (is('smb')) { // smb3
					add(nameOnly, 'Super Mario');
					add(nameScore, 'Ticket Champion');
				}
				if (is('spacej')) { // spacejam
					add(onlyName, '12 Baskets in a Row');
					add(onlyName, '8 Baskets in a Row');
				}
				if (is('ss')) { // ss_15
					add(nameInfo, 'Spider Champion');
				}
				if (is('starga')) { // stargate
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
				if (is('tmnt')) { // tmnt_103
					add(nameScore, 'Loop Record');
				}
				if (is('tfight')) { // tfight
					add(nameDashScore, 'Highest punches');
				}
				if (is('ts')) { // ts_la2
					add(listName, 'final battle immortals', 'Final Battle Immortal');
					add(nameScore, 'Buyin Champion');
					add(nameInfo, 'Shadow Loop Champ');
				}
				if (is('twst')) { // twst_300
					add(nameOnly, 'Triple Jackpot');
				}
				if (is('tz')) { // tz_92
					add(listRankNameScore, 'Lost in the Zone Champion');
				}
				if (is('usafoot')) { // usafootb
					add(listRankNameScore, 'Most Valuable Player');
				}
				if (is('vegas')) { // vegas
					add(nameOnly, 'Slot King');
				}
				if (is('viprsega')) { // viprsega
					// ION   8,120 MILES
					if (m = block.match(/([\w\s+]{3})\s+([\d',]+) miles/i)) {
						return { title: 'Distance', player: player(m[1]), info: num(m[2]) + ' Miles' }
					}
				}
				if (is('waterwl')) { // waterwld
					add(infoEqualsScoreName, 'icthy freak', 'Itchy Freak');
				}
				if (is('wcs')) { // wcs_l2
					add(nameInfo, 'Final Match Goal Champ');
					add(listRankNameScore, 'Honor Roll');
				}
				if (is('wcsocc')) { // wcsoccer
					add(nameOnly, 'World Champ');
					add(nameScore, 'you have the most goals.', 'Most Goals');
					add(listRankNameScore, 'MVP');
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

					console.log('\n===================================================================');
					console.log(romname);
					console.log('===================================================================');
					console.log(stdout);
					console.log('-------------------------------------------------------------------');
					console.log('Unknown block: \n' + b[i] + '\n');
					console.log('===================================================================');
					scores.raw = stdout;
					callback(b[i], scores);
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
exports.assertAll = function(startWith) {
	if (!startWith) {
		startWith = '0';
	}
	var skip = [ 'mm_109c', 'punchy', 'rct600', 'trucksp2', 'trucksp3', 'wcsoccd2', 'wd_03r' ];
	var files = fs.readdirSync(settings.vpinmame.path + '/nvram');
	var nvrams = [];
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		if (file[0] < startWith) {
			continue;
		}
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
					console.log('\n' + nvram);
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

function tr(str) {
	return str.toLowerCase().trim();
}

function player(str) {
	return str.trim();
}

function binPath() {
	return fs.realpathSync(__dirname + '../../../bin');
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
};
/**
 * Example:
 *  LON
 *  12 BASKETS IN A ROW!
 *
 * @param block
 * @param str
 * @param title
 * @returns {*}
 */
var onlyName = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp('([\\w\\s]{3})\\s+' + str, 'i'))) {
		return { title: title, player: player(m[1]) }
	}
	return false;
};
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
	if (m = block.match(new RegExp(str + '\\s+([\\w\\s]{3})\\s+(\\$\\s+)?([\\d\',]+)', 'i'))) {
		return { title: title, player: player(m[1]), score: num(m[3]) }
	}
	return false;
};
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
};
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
};
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
};
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
};
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
};
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
		var regex = new RegExp(/([\w\s+]{3})\s+([\d',]+)/g);
		while (m = regex.exec(b)) {
			ret.push({ title: title, player: player(m[1]), score: num(m[2]) });
		}
		return ret;
	}
	return false;
};
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
		var regex = new RegExp(/#?(\d).?\s+([\w\s+]{3})\s+(\$\s+)?([\d',]+)/g);
		while (m = regex.exec(b)) {
			ret.push({ title: title, rank: m[1], player: player(m[2]), score: num(m[4]) });
		}
		return ret;
	}
	return false;
};
/**
 * Example:
 *
 *   5 MULTIBALLS CHAMPS
 *   1) JEK
 *   2) JEK
 *   3) JEK
 *   4) JEK
 *   5) JEK
 *
 * @param block
 * @param str
 * @param title
 * @returns {*}
 */
var listRankName = function(block, str, title) {
	var m;
	if (!title) {
		title = str;
	}
	if (m = block.match(new RegExp(str + '\\s+([\\s\\S]+)', 'i'))) {
		var b = m[1];
		var ret = [];
		var regex = new RegExp(/#?(\d).?\s+([\w\s+]{3})/g);
		while (m = regex.exec(b)) {
			ret.push({ title: title, rank: m[1], player: player(m[2]) });
		}
		return ret;
	}
	return false;
};
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
		var regex = new RegExp(/(\d).?\s+([\w\s+]{3})\s+(.+[\n\r]+.+)/g);
		var i = 0;
		while (m = regex.exec(b)) {
			ret.push({ title: title, rank: m[1], player: player(m[2]), info: tidy(m[3]) });
			i++;
		}
		return i ? ret : false;
	}
	return false;
};
