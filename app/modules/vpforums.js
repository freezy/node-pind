var fs= require('fs');
var util = require('util');
var request = require('request');
var natural = require('natural');

var schema = require('../model/schema');
var settings = require('../../config/settings-mine');
var error = require('./error');

var socket;

module.exports = function(app) {
	socket = app.get('socket.io');
	return exports;
};


exports.findMediaPack = function(table, callback) {
	console.log('[vpf] Searching media pack for "' + table.name + '"...');
	fetchDownloads(35, table.name[0], function(err, results) {

		var match = matchResult(results, table.name, function(str) {
			return str.replace(/[\[\(].*/, '').trim();
		})[0];

		exports.download(match.url, settings.pind.tmp, function(err, filename) {
			if (!err) {
				console.log('[vpf] Downloaded file to: %s', filename);
			} else {
				console.log('[vpf] Error downloading: %s', err);
			}
			logout(function(err) {
				if (err) {
					console.log('[vpf] ERROR: ' + err);
				}
			});
		});
	});
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
	fetchDownloads(9, table.name[0], function(err, results) {
		if (err) {
			return callback(err);
		}
		var matches = matchResult(results, table.name, function(str) {
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

	socket.emit('notice', { msg: 'VPF: Downloading "' + link.filename + '"', timeout: 60000 });

	// fetch the "overview" page
	request(link.url, function(err, response, body) {
		if (err) {
			return callback(err);
		}

		// starts the download, assuming we have a logged session.
		var download = function(body) {
			socket.emit('notice', { msg: 'VPF: Downloading "' + link.filename + '"', timeout: 60000 });
			var m;
			if (m = body.match(/<a\s+href='([^']+)'\s+class='download_button[^']*'>/i)) {
				var confirmUrl = m[1].replace(/&amp;/g, '&');
				console.log('[vpf] Getting confirmation page...');
				// fetch the "confirm" page, where the actual link is
				request(confirmUrl, function(err, response, body) {
					if (err) {
						callback(err);
					} else {
						if (m = body.match(/<a\s+href='([^']+)'\s+class='download_button[^']*'>\s*Download\s*<\/a>[\s\S]*?<strong\s+class='name'>([^<]+)/i)) {
							var downloadUrl = m[1].replace(/&amp;/g, '&');
							var filename = m[2].replace(/[^\w\d\.\-]/gi, '').trim();
							var dest = folder + '/' + filename;
							console.log('[vpf] Downloading %s at %s...', filename, downloadUrl);
							var stream = fs.createWriteStream(dest);
							stream.on('close', function() {
								console.log('[vpf] Download completed at %s.', dest);
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

function matchResult(results, title, trimFct) {
	var matches = [];
	var distance = 10;
	for (var i = 0; i < results.length; i++) {
		var result = results[i];
		var name = trimFct(result.title);
		var d = natural.LevenshteinDistance(title.toLowerCase(), name.toLowerCase());
		if (d < distance) {
			matches = [ result ];
			distance = d;
		} else if (d == distance) {
			matches.push(result);
		}
	}
	return matches;
}

function fetchDownloads(cat, letter, callback, currentResult) {

	var fetch = function(cat, letter, callback, currentResult, page) {
		var numPages = 1;
		var url = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=categoryletters&cat=' + cat + '&letter=' + letter + '&sort_order=ASC&sort_key=file_name&num=10&st=' + ((page - 1) * 10);
		console.log('[vpf] Fetching page ' + page + ' for category ' + cat + ' and letter "' + letter + '".');
		request(url, function (err, response, body) {
			if (err) {
				console.log('[vpf] Error retrieving ' + url + ': ' + err);
				return callback('Error retrieving ' + url + ': ' + err);
			}
			var m;
			if (m = body.match(/<li class='pagejump[^']+'>\s+<a[^>]+>Page \d+ of (\d+)/i)) {
				numPages = m[1];
			} else {
				var debugFile = error.dumpDebugData('vpf', 'no-numpage', body, 'html');
				console.log('[vpf] Could not parse number of pages at ' + url + '. See ' + debugFile);
				return callback('Could not parse number of pages at ' + url);
			}
			var regex = new RegExp(/<h3\s+class='ipsType_subtitle'>\s+<a\s+href='([^']+)'\s+title='View file named ([^']+)/gi);
			while (m = regex.exec(body)) {
				currentResult.push({ url: m[1].replace(/&amp;/g, '&'), title: m[2].trim() });
			}
			if (page >= numPages) {
				// update cache
				console.log('[vpf] Updating cache...');
				schema.CacheVpfDownload.create({
					category: cat,
					letter: letter.toLowerCase(),
					data: JSON.stringify(currentResult)
				}).success(function(cache) {
					callback(null, currentResult);
				}).error(callback);
				
			} else {
				fetch(cat, letter, callback, currentResult, page + 1);
			}
		});
	};

	// check cache first.
	schema.CacheVpfDownload.all({ where: { category: cat, letter: letter.toLowerCase() }}).success(function(rows) {
		if (rows.length == 0) {
			// if empty, launch fetch.
			fetch(cat, letter, callback, [], 1);
		} else {
			callback(null, JSON.parse(rows[0].data));
		}
	});
}

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

function logout(callback) {
	// fetch another damn id
	console.log('[vpf] Logging out...');
	request('http://www.vpforums.org/index.php', function(err, response, body) {
		if (err) {
			callback(err);
			return;
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
}
