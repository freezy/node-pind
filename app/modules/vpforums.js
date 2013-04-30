var fs= require('fs');
var unzip = require('unzip');
var util = require('util');
var async = require('async');
var request = require('request');
var natural = require('natural');
var jsdom = require('jsdom').jsdom;
var jquery = require('jquery');

var schema = require('../model/schema');
var settings = require('../../config/settings-mine');
var error = require('./error');

var socket;

module.exports = function(app) {
	socket = app.get('socket.io');
	return exports;
};

/**
 * Finds and downloads either a media pack or a table video.
 *
 * @param cat VPF category
 * @param table Table of the media pack
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Absolute file path of the downloaded archive.</li></ol>
 */
var findMedia = function(table, cat, callback) {
	console.log('[vpf] Searching media pack for "' + table.name + '"...');
	fetchDownloads(35, table.name, function(err, results) {
		if (err) {
			return callback(err);
		}
		var match = matchResult(results, table.name, function(str) {
			return str.replace(/[\[\(].*/, '').trim();
		}, 'intelligent');
		if (!match) {
			return callback('Cannot find any media with name similar to "' + table.name + '".');
		}
		exports.download(match, settings.pind.tmp, function(err, filename) {
			if (err) {
				console.log('[vpf] Error downloading: %s', err);
				return callback(err);
			}
			console.log('[vpf] Downloaded file to: %s', filename);
			callback(null, filename);
		});
	});
};

/**
 * Finds a media pack and downloads it.
 * @param table Table of the media pack
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Absolute file path of the downloaded archive.</li></ol>
 */
exports.findMediaPack = function(table, callback) {
	if (table.platform == 'VP') {
		findMedia(table, 35, callback);
	} else {
		findMedia(table, 36, callback);
	}
};

/**
 * Finds a table video and downloads it.
 * @param table Table of the media pack
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Absolute file path of the downloaded archive.</li></ol>
 */
exports.findTableVideo = function(table, callback) {
	if (table.platform == 'VP') {
		findMedia(table, 43, callback);
	} else {
		findMedia(table, 34, callback);
	}
};

/**
 * Returns a list of links to all ROM files for a given table.
 * @param table Row from tables database.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of found links. Links are objects with <tt>name</tt> and <tt>url</tt>.</li></ol>
 */
exports.getRomLinks = function(table, callback) {

	console.log('[vpf] Searching ROM for "' + table.name + '"...');
	socket.emit('notice', { msg: 'VPF: Searching ROM for "' + table.name + '"', timeout: 120000 });
	fetchDownloads(9, table.name, function(err, results) {
		if (err) {
			return callback(err);
		}
		var matches = matchResults(results, table.name, function(str) {
			return str.replace(/[\[\(\-].*/, '').trim();
		});
		var links = [];
		for (var i = 0; i < matches.length; i++) {
			links.push({
				title: matches[i].title,
				url:  matches[i].url,
				filename: matches[i].title.substr(matches[i].title.length - 4).toLowerCase() == '.zip'
					? matches[i].title.substr(matches[i].title.lastIndexOf(' ') + 1).trim()
					: null
			});
		}
		callback(null, links);
	});
};

/**
 * Downloads a file from vpforums.org.
 * @param link
 * @param folder
 * @param callback
 */
exports.download = function(link, folder, callback) {

	socket.emit('notice', { msg: 'VPF: Starting download ' + (link.filename ? ' for "' + link.filename + '"' : ''), timeout: 60000 });

	// fetch the "overview" page
	request(link.url, function(err, response, body) {
		if (err) {
			return callback(err);
		}

		// starts the download, assuming we have a logged session.
		var download = function(body) {
			socket.emit('notice', { msg: 'VPF: Progressing download', timeout: 60000 });
			var m;
			if (m = body.match(/<a\s+href='([^']+)'\s+class='download_button[^']*'>/i)) {
				var confirmUrl = m[1].replace(/&amp;/g, '&');
				console.log('[vpf] Getting confirmation page at %s...', confirmUrl);
				// fetch the "confirm" page, where the actual link is
				request(confirmUrl, function(err, response, body) {

					if (err) {
						callback(err);
					} else {
						if (m = body.match(/<a\s+href='([^']+)'\s+class='download_button[^']*'>\s*Download\s*<\/a>[\s\S]*?<strong\s+class='name'>([^<]+)/i)) {
							var downloadUrl = m[1].replace(/&amp;/g, '&');
							var filename = m[2].trim().replace(/\s/g, '.').replace(/[^\w\d\.\-]/gi, '');
							var dest = folder + '/' + filename;
							socket.emit('notice', { msg: 'VPF: Downloading "' + filename + '"', timeout: 60000 });
							console.log('[vpf] Downloading %s at %s...', filename, downloadUrl);
							var stream = fs.createWriteStream(dest);
							stream.on('close', function() {
								var size = fs.fstatSync(fs.openSync(dest, 'r')).size;
								console.log('[vpf] Downloaded %d bytes to %s.', size, dest);

								if (size < 64000) {
									var data = fs.readFileSync(dest, 'utf8');
									if (data.match(/You have exceeded the maximum number of downloads allotted to you for the day/i)) {
										console.log('[vpf] Download data is error message, quitting.', size, dest);
										return callback('Number of downloads exceeded at VPF.');
									}
								}
								callback(null, dest);
							});
							request(downloadUrl).pipe(stream);
						} else {
							callback('Cannot find file download button at ' + link);
						}
					}
				});
			} else {
				callback('Cannot find confirmation download button at ' + link);
			}
		};

		// check if need to login
		if (body.match(/<a href='[^']+' title='Sign In' id='sign_in'>Sign In/i)) {
			console.log('[vpf] Seems we need to login first.');
			login(function(err) {
				if (err) {
					return callback(err);
				}
				download(body);
			});
		} else {
			console.log('[vpf] Looks like we\'re already logged in.');
			download(body);
		}
	});
};

/**
 * Finds the best matches for a list of results (typically all items of a letter).
 * Returns all matches if Levenshtein distance is equal for best matches.
 *
 * @param results Result from #fetchDownloads()
 * @param title Title to match against
 * @param trimFct Trims off title of results for better matches
 * @param maxDistance Maximal Lebenshtein Distance to original name.
 * @returns {Array}
 */
function matchResults(results, title, trimFct, maxDistance) {

	var matches = [];
	var distance = maxDistance ? maxDistance : 10;
	for (var i = 0; i < results.length; i++) {
		var result = results[i];
		var name = trimFct(result.title);
		var d = natural.LevenshteinDistance(title.toLowerCase(), name.toLowerCase());
		//console.log('%s %s - %s', d, title, name);
		if (d < distance) {
			matches = [ result ];
			distance = d;
		} else if (d == distance) {
			matches.push(result);
		}
	}
	return matches;
}

/**
 * Finds the best single match for a list of results.
 * @param results Results from #fetchDownloads()
 * @param title Title to match against
 * @param trimFct Trims off title of results for better matches
 * @param strategy How to determine best match on tie. Valid values: "latest", "mostDownloaded", "mostViewed". Default "intelligent".
 */
function matchResult(results, title, trimFct, strategy) {
	var matches = matchResults(results, title, trimFct);
	console.log('Got matches: %j', matches);
	matches.sort(function(a, b) {
		var x;
		switch (strategy) {
			case 'mostDownloaded':
				x = a.downloads > b.downloads;
				break;
			case 'mostViewed':
				x = a.views > b.views;
				break;
			case 'latest':
				x = a.updated > b.updated;
				break;
			case 'intelligent':
			default:
				var daysApart = Math.abs(a.updated - b.updated) / 86400000;
				var youngestAge = Math.max(a.updated, b.updated) / 86400000;
				/*
				 * We want the most common version but give new releases a chance.
				 * Feel free to tweak.
				 */
				if (daysApart < 10 || youngestAge > 60) {
					x = a.downloads > b.downloads;
				} else {
					x = a.updated > b.updated;
				}

		}
		return x ? -1 : 1;
	});
	return matches[0];
}

/**
 * Retrieves all downloadable items for a given category and letter. This is a
 * cached operation, items are only downloaded the first time.
 *
 * @todo Cache invalidation
 * @param cat VPF category
 * @param title First letter
 * @param callback Callback.
 */
function fetchDownloads(cat, title, callback) {

	// recursive function that fetches items from vpforums.org.
	var fetch = function(cat, letter, currentResult, page, callback) {
		var numPages;
		var url;
		var num = 25;
		if (letter) {
			url = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=categoryletters&cat=' + cat + '&letter=' + letter + '&sort_order=ASC&sort_key=file_name&num=' + num + '&st=' + ((page - 1) * num);
			console.log('[vpf] Fetching page ' + page + ' for category ' + cat + ' and letter "' + letter + '".');
		} else {
			url = 'http://www.vpforums.org/index.php?app=downloads&showcat=' + cat + '&num=' + num + '&st=' + ((page - 1) * num);
			console.log('[vpf] Fetching page ' + page + ' for category ' + cat + '.');
		}

		var saveToCache = function(cat, letter, data, callback) {
			// update cache
			console.log('[vpf] Updating cache for letter "%s"...', letter);
			schema.CacheVpfDownload.create({
				category: cat,
				letter: letter,
				data: JSON.stringify(data)
			}).done(function() {
				callback(null, data);
			});
		};
		request(url, function(err, response, body) {
			if (err) {
				console.log('[vpf] Error retrieving ' + url + ': ' + err);
				return callback('Error retrieving ' + url + ': ' + err);
			}
			var m;
			if (m = body.match(/<li class='pagejump[^']+'>\s+<a[^>]+>Page \d+ of (\d+)/i)) {
				numPages = m[1];
			} else {
				//var debugFile = error.dumpDebugData('vpf', 'no-numpage', body, 'html');
				//console.log('[vpf] Could not parse number of pages at ' + url + '. See ' + debugFile);
				console.log('[vpf] Could not parse number of pages, assuming one page only.');
				numPages = 1;
			}

			// initialize jquery on result
			var $ = jquery.create(jsdom(body).createWindow());
			async.eachSeries($('.idm_category_row'), function(that, next) {

				var fileinfos = $(that).find('.file_info').html().match(/([\d,]+)\s+downloads\s+\(([\d,]+)\s+views/i);
				currentResult.push({
					url: $(that).find('h3.ipsType_subtitle a').attr('href').replace(/s=[a-f\d]+&?/gi, ''),
					title: $(that).find('h3.ipsType_subtitle a').attr('title').replace(/^view file named\s+/ig, ''),
					downloads: parseInt(fileinfos[1].replace(/,/, '')),
					views: parseInt(fileinfos[2].replace(/,/, '')),
					updated: Date.parse($(that).find('.file_info .date').html().trim().replace(/^added|^updated/i, '').trim())
				});
				next();

			}, function() {
				if (page >= numPages) {
					if (letter) {
						saveToCache(cat, letter.toLowerCase(), currentResult, callback);
					} else {
						// first, sort array by title.
						currentResult = currentResult.sort(function(a, b) {	
							if (a.title[0].toLowerCase() < b.title[0].toLowerCase())
								return -1;
							if (a.title[0].toLowerCase() > b.title[0].toLowerCase())
								return 1;
							return 0;
						});
						// everything was fetched, so split by letter
						var letter;
						var previousLetter = '0';
						var results = { letter: previousLetter, data: [] };
						var allResults = [];
						for(var i = 0; i < currentResult.length; i++) {
							var l = currentResult[i].title[0];
							if (l.match(/\d/)) {
								letter = '0';
							} else {
								letter = l.toLowerCase();
							}
							if (letter != previousLetter) {
								allResults.push(results);
								results = { letter: letter, data: [] };
							}
							results.data.push(currentResult[i]);

							// on last result, push and we're done.
							if (i == currentResult.length - 1) {
								allResults.push(results);
							}
							previousLetter = letter;
						}
						async.eachSeries(allResults, function(results, next) {
							saveToCache(cat, results.letter, results.data, next);

						}, function(err) {
							if (err) {
								return callback(err);
							}
							callback(null, currentResult);
						});
					}
				} else {
					fetch(cat, letter, currentResult, page + 1, callback);
				}
			});

		});
	};

	/**
	 * Callback that potentially adds another letter to the result.
	 * @param err
	 * @param result
	 */
	var goAgainOrCallback = function(err, result) {
		var words = title.toLowerCase().split(' ');

		if (words[0] == 'the' && words[0][0] != words[1][0]) {
			console.log('[vpf] Title starts with "The", let\'s fetch also letter "%s" for second word.', words[1][0]);

			// check cache first.
			schema.CacheVpfDownload.all({ where: { category: cat, letter: words[1][0] }}).success(function(rows) {
				if (rows.length == 0) {
					// if empty, launch fetch.
					fetch(cat, words[1][0], result, 1, callback);
				} else {
					callback(null, result.concat(JSON.parse(rows[0].data)));
				}
			});
		} else {
			callback(null, result);
		}
	};

	// check cache first.
	schema.CacheVpfDownload.all({ where: { category: cat, letter: title[0].toLowerCase() }}).success(function(rows) {
		if (rows.length == 0) {
			// if empty, launch fetch.
			fetch(cat, title[0], [], 1, goAgainOrCallback);
		} else {
			console.log('[vpf] Returning cached letter "%s".', title[0]);
			goAgainOrCallback(null, JSON.parse(rows[0].data));
		}
	});


}

/**
 * Logs the user on vpforums.org in order to obtain download permissions.
 *
 * @param callback Function to execute after completion, invoked with one argument:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
function login(callback) {
	if (!settings.vpforums.user || !settings.vpforums.pass) {
		return callback('Need valid credentials for vpforums.org. Please update settings-mine.js.');
	}
	console.log('[vpf] Logging in...');
	socket.emit('notice', { msg: 'VPF: Logging in as "' + settings.vpforums.user + '"', timeout: 60000 });

	// just get the index to obtain the damn auth key
	request('http://www.vpforums.org/index.php', function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}
		var m = body.match(/<input\s+type='hidden'\s+name='auth_key'\s+value='([^']+)/i);
		if (!m) {
			callback('Cannot find auth key in index page.');
		} else {
			console.log('[vpf] Got auth key: ' + m[1]);

			// post credentials
			request.post({
				url: 'http://www.vpforums.org/index.php?app=core&module=global&section=login&do=process',
				form: {
					auth_key: m[1],
					anonymous: '1',
					referer: 'http://www.vpforums.org/index.php',
					ips_username: settings.vpforums.user,
					ips_password: settings.vpforums.pass
				}
			}, function(err, response, body) {
				if (err) {
					callback(err);
					return;
				}

				// redirect means all ok.
				if (response.statusCode == 302) {
					console.log('[vpf] Login successful.');
					callback();
					return;
				}

				if (body.match(/username or password incorrect/i)) {
					callback('Wrong credentials, check your settings-mine.js.');
					return;
				}

				callback('Unexpected response.');
			})
		}
	});
}

/**
 * Destroys the current VPF session. Typically called after longish fetching
 * routines.
 *
 * @param callback Function to execute after completion, invoked with one argument:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
exports.logout = function(callback) {
	// fetch another damn id
	console.log('[vpf] Logging out...');
	request('http://www.vpforums.org/index.php', function(err, response, body) {
		if (err) {
			return callback(err);
		}
		var m;
		if (m = body.match(/<a\shref="([^"]+do=logout[^"]+)/)) {
			request(m[1], function(err, response, body) {
				if (err) {
					callback(err);
				} else {
					console.log('[vpf] Logout successful.');
					callback();
				}
			});
		} else {
			callback('It looks like the nobody is logged in the current VPF session.');
		}
	});
};

/**
 * Extracts a media pack or table video to the correct location. Will not 
 * overwrite anything if files exist already.
 * @param table Row from table
 * @param path Path to the zip archive
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of extracted files.</li></ol>
 */
exports.extractMedia = function(table, path, callback) {
	var extractedFiles = [];
	fs.createReadStream(path)
		.pipe(unzip.Parse())
		.on('entry', function (entry) {
			try {
				var dirnames = entry.path.split('/');
				var filename = dirnames.pop();
				var l = dirnames.length - 1;

				var extract = function(entry, dirnames, filename, depth) {
					var ext = filename.substr(filename.lastIndexOf('.'));
					var dest = settings.hyperpin.path + '/Media/' + dirnames.slice(dirnames.length - depth, dirnames.length).join('/') + '/' + table.hpid + ext;
					if (!fs.existsSync(dest)) {
						console.log('Extracting "%s" to "%s"...', entry.path, dest);
						extractedFiles.push(dest);
						entry.pipe(fs.createWriteStream(dest));
					} else {
						console.log('"%s" already exists, skipping.', dest);
						entry.autodrain();
					}
				}

				if (filename) {
					if (['Visual Pinball', 'Future Pinball'].indexOf(dirnames[l - 1]) > -1) {
						if (['Backglass Images', 'Table Images', 'Table Videos', 'Wheel Images'].indexOf(dirnames[l]) > -1) {
							extract(entry, dirnames, filename, 2);
						} else {
							entry.autodrain();
						}

					} else if (['HyperPin'].indexOf(dirnames[l - 2]) > -1) {

						// flyers seem to have a naming convention problem..
						if (dirnames[l - 1] == 'Flyers') {
							dirnames[l - 1] = 'Flyer Images';
						}

						if (['Flyer Images'].indexOf(dirnames[l - 1]) > -1) {
							extract(entry, dirnames, filename, 3);
						} else {
							entry.autodrain();
						}

					} else if (['HyperPin'].indexOf(dirnames[l - 1]) > -1) {

						if (['Instruction Cards'].indexOf(dirnames[l]) > -1) {
							extract(entry, dirnames, filename, 2);
						} else {
							entry.autodrain();
						}
					} else {
						//console.log('2 Ignoring %s (%s)', entry.path, dirnames[l - 2]);
						entry.autodrain();
					}
				} else {
					//console.log('3 Ignoring %s', entry.path);
					entry.autodrain();
				}
			} catch (err) {
				callback(err.message);
			}
		})
		.on('close', function() {
			if (callback) {
				callback(null, extractedFiles);
			}
		});
};

/**
 * Fetches all current downloads in the "VP cabinet tables" section (and 
 * automatically caches them).
 *
 * The goal of this is to be able to link already downloaded tables to a forum
 * thread for future updates.
 *
 * @param callback 
 */
exports.cacheAllTableDownloads = function(callback) {

	fetchDownloads(41, null, function(err, results) {
		if (err) {
			return console.log('ERROR: %s', err);
		}
		console.log('RESULT = %s', util.inspect(results));
	});
}