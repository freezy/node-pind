var fs= require('fs');
var util = require('util');
var request = require('request');
var natural = require('natural');
var settings = require('../../config/settings-mine');

exports.findMediaPack = function(table, callback) {
	console.log('Searching media pack for "' + table.name + '"...');
	fetchDownloads(35, table.name[0], function(err, results) {
		var bestMatch, distance = 10;
		for (var i = 0; i < results.length; i++) {
			var result = results[i];
			var name = result.title.replace(/[\[\(].*/, '').trim();
			var d = natural.LevenshteinDistance(table.name.toLowerCase(), name.toLowerCase());
			console.log('%d %s', d, name);
			if (d < distance) {
				bestMatch = result;
				distance = d;
				if (d == 0) {
					break;
				}
			}
		}
		console.log('Best Match: %j', bestMatch);
		download(bestMatch.url, function(err, filename) {
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
		var regex = new RegExp(/<h3\s+class='ipsType_subtitle'>\s+<a\s+href='([^']+)[^>]+>([^<]+)/gi);
		while (m = regex.exec(body)) {
			currentResult.push({ url: m[1].replace(/&amp;/g, '&'), title: m[2] });
		}
		if (numPages == page) {
			callback(null, currentResult);
		} else {
			fetchDownloads(cat, letter, callback, currentResult, page + 1);
		}
	});
}

function download(url, callback) {
	login(function(err) {
		if (err) {
			callback(err);
			return;
		}
		console.log('Getting download page...');

		// fetch the "overview" page
		request(url, function(err, response, body) {
			if (err) {
				callback(err);
			} else {
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
								console.log('Downloading "' + filename + '"...');
								request(downloadUrl)
								  .pipe(fs.createWriteStream(settings.pind.tmp + '/' + filename))
								  .on('end', function(err) {
									if (err) {
										callback(err);
									} else {
										console.log('Download complete.');
										callback(null, settings.pind.tmp + '/' + filename);
									}
								});
							} else {
								callback('Cannot find file download button at ' + url);
							}
						}
					});
				} else {
					callback('Cannot find confirmation download button at ' + url);
				}
			}
		});
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
