var fs= require('fs');
var util = require('util');
var request = require('request');
var natural = require('natural');
var settings = require('../../config/settings-mine');

exports.findMediaPack = function(table, callback) {
	console.log('Searching media pack for "' + table.name + '"...');
	fetchDownloads(35, table.name[0], function(err, results) {

		var match = matchResult(results, table.name, function(str) {
			return str.replace(/[\[\(].*/, '').trim();
		})[0];

		exports.download(match.url, settings.pind.tmp, function(err, filename) {
			if (!err) {
				console.log('Downloaded file to: %s', filename);
			} else {
				console.log("Error downloading: %s", err);
			}
			logout(function(err) {
				if (err) {
					console.log(err);
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
	console.log('Searching ROM for "' + table.name + '"...');
	fetchDownloads(9, table.name[0], function(err, results) {
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

	// fetch the "overview" page
	request(link.url, function(err, response, body) {
		if (err) {
			return callback(err);
		}

		// starts the download, assuming we have a logged session.
		var download = function(body) {
			var m;
			if (m = body.match(/<a\s+href='([^']+)'\s+class='download_button[^']*'>/i)) {
				var confirmUrl = m[1].replace(/&amp;/g, '&');
				console.log('Getting confirmation page...');
				// fetch the "confirm" page, where the actual link is
				request(confirmUrl, function(err, response, body) {
					if (err) {
						callback(err);
					} else {
						if (m = body.match(/<a\s+href='([^']+)'\s+class='download_button[^']*'>\s*Download\s*<\/a>[\s\S]*?<strong\s+class='name'>([^<]+)/i)) {
							var downloadUrl = m[1].replace(/&amp;/g, '&');
							var filename = m[2].replace(/[^\w\d\.\-]/gi, '').trim();
							var dest = folder + '/' + filename;
							console.log('Downloading %s at %s...', filename, downloadUrl);
							var stream = fs.createWriteStream(dest);
							stream.on('close', function() {
								console.log('Download completed at %s.', dest);
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
			console.log('Seems we need to login first.');
			login(function(err) {
				if (err) {
					return callback(err);
				}
				download(body);
			});
		} else {
			console.log('Looks like we\'re already logged in.');
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

function fetchDownloads(cat, letter, callback, currentResult, page) {
	if (!page) {
		page = 1;
	}
	if (!currentResult) {
		currentResult = [];
	}
	var numPages = 1;
	var url = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=categoryletters&cat=' + cat + '&letter=' + letter + '&sort_order=ASC&sort_key=file_name&num=10&st=' + ((page - 1) * 10);
	console.log('Fetching page ' + page + ' for category ' + cat + ' and letter "' + letter + '".');
	request(url, function (error, response, body) {
		var m;
		if (m = body.match(/<li class='pagejump[^']+'>\s+<a[^>]+>Page \d of (\d+)/i)) {
			numPages = m[1];
		}
		var regex = new RegExp(/<h3\s+class='ipsType_subtitle'>\s+<a\s+href='([^']+)'\s+title='View file named ([^']+)/gi);
		while (m = regex.exec(body)) {
			currentResult.push({ url: m[1].replace(/&amp;/g, '&'), title: m[2].trim() });
		}
		if (numPages == page) {
			callback(null, currentResult);
		} else {
			fetchDownloads(cat, letter, callback, currentResult, page + 1);
		}
	});
}

function login(callback) {
	if (!settings.vpforums.user || !settings.vpforums.pass) {
		callback('Need valid credentials for vpforums.org. Please update settings-mine.js.');
	}
	console.log('Logging in...');

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
			console.log('Got auth key: ' + m[1]);

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
					console.log('Login successful.');
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
	console.log('Logging out...');
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
					console.log('Logout successful.');
					callback();
				}
			});
		} else {
			callback('It looks like the nobody is logged in the current VPF session.');
		}
	});
}
