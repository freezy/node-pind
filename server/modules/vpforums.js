'use strict';

var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var async = require('async');
var jsdom = require('jsdom').jsdom;
var events = require('events');
var jquery = require('jquery');
var chrono = require('chrono-node');
var logger = require('winston');
var request = require('request');
var natural = require('natural');

var settings = require('../../config/settings-mine');
var schema = require('../database/schema');

var an = require('./announce');
var error = require('./error');

var loggingIn = false;
var isDownloadingIndex = false;
var isCreatingIndex = false;

function VPForums() {
	events.EventEmitter.call(this);
	this.initAnnounce();
}
util.inherits(VPForums, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 */
VPForums.prototype.initAnnounce = function() {

	var ns = 'vpf';

	// getRomLinks()
	an.notice(this, 'romSearchStarted', 'VPF: Searching ROM for "{{name}}"', 120000);

	// fetchDownloads()
	an.forward(this, 'downloadProgressUpdated', ns);

	// download()
	an.notice(this, 'downloadInitializing', 'VPF: Initializing download {{fileinfo}}', 60000);
	an.notice(this, 'downloadPreparing', 'VPF: Preparing download', 60000);
	an.notice(this, 'downloadStarted', 'VPF: Downloading "{{filename}}"', 300000);
	an.notice(this, 'downloadCompleted', 'VPF: {{size}} bytes downloaded.');
	an.notice(this, 'downloadFailed', 'VPF: Download failed: {{message}}');

	// login()
	an.notice(this, 'loginStarted', 'VPF: Logging in as "{{user}}"', 30000);

	// index
	an.data(this, 'createIndexStarted',    { id: 'crvpfindex' }, ns);
	an.data(this, 'createIndexCompleted',  { id: 'crvpfindex' }, ns);
	an.data(this, 'createIndexCompleted',  {}, ns, 'indexUpdated');
	an.data(this, 'refreshIndexStarted',   { id: 'dlvpfindex' }, ns);
	an.data(this, 'refreshIndexCompleted', { id: 'dlvpfindex' }, ns);
	an.data(this, 'refreshIndexCompleted',  {}, ns, 'indexUpdated');
	an.notice(this, 'downloadIndexFailed', 'Index download failed: {{error}}');
	an.notice(this, 'downloadIndexFailed', 'Index update failed: {{error}}');

	// "inverse" method calls
	an.forward(this, 'queueTransfer');
};

/**
 * Finds and downloads either a media pack or a table video.
 *
 * @param cat VPF category
 * @param table Table of the media pack
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Success message from transfer.</li></ol>
 */
VPForums.prototype._findMedia = function(table, cat, callback) {

	var that = this;
	logger.log('info', '[vpf] Searching media pack for "%s"...', table.name);
	this._fetchDownloads(35, table.name, {}, function(err, results) {
		if (err) {
			logger.log('error', '[vpf] Error fetching downloads: %s', err);
			return callback(err);
		}
		var match = VPForums.prototype._matchResult(results, table.name, function(str) {
			return str.replace(/[\[\(].*/, '').trim();
		}, 'intelligent');
		if (!match) {
			return callback('Cannot find any media with name similar to "' + table.name + '".');
		}

		that.emit('queueTransfer', {
			title: match.title,
			url: 'http://www.vpforums.org/index.php?app=downloads&showfile=' + match.fileId,
			type: 'mediapack',
			engine: 'vpf',
			reference: match.id
		});
		callback();
	});
};

/**
 * Finds a media pack and downloads it.
 * @param table Table of the media pack
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Success message from transfer.</li></ol>
 */
VPForums.prototype.findMediaPack = function(table, callback) {
	if (table.platform == 'VP') {
		VPForums.prototype._findMedia(table, 35, callback);
	} else {
		VPForums.prototype._findMedia(table, 36, callback);
	}
};

/**
 * Finds a table video and downloads it.
 * @param table Table of the media pack
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Absolute file path of the downloaded archive.</li></ol>
 */
VPForums.prototype.findTableVideo = function(table, callback) {
	if (table.platform == 'VP') {
		this._findMedia(table, 43, callback);
	} else {
		this._findMedia(table, 34, callback);
	}
};

/**
 * Returns a list of links to all ROM files for a given table.
 * @param table Row from tables database.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of found links. Links are objects with <tt>title</tt>, <tt>filename</tt> and <tt>url</tt>.</li></ol>
 */
VPForums.prototype.getRomLinks = function(table, callback) {

	var that = this;
	logger.log('info', '[vpf] Searching ROM for "%s"...', table.name);
	this.emit('romSearchStarted', { name: table.name });
	that._fetchDownloads(9, table.name, {}, function(err, results) {
		if (err) {
			return callback(err);
		}
		//noinspection JSCheckFunctionSignatures
        var matches = VPForums.prototype._matchResults(results, table.name, function(str) {
			return str.replace(/[\[\(\-].*/, '').trim();
		});
		var links = [];
		for (var i = 0; i < matches.length; i++) {
			links.push({
				id: matches[i].id,
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
 * @param transfer
 * @param watcher File watcher. Must implement watch() and unwatch().
 * @param callback
 */
VPForums.prototype.download = function(transfer, watcher, callback) {
	var that = this;

	that.emit('downloadInitializing', { reference: transfer, fileinfo: transfer.filename ? ' for "' + transfer.filename + '"' : '' });

	// fetch the "overview" page
	request({ url: transfer.url, jar: true }, function(err, response, body) {
		if (err) {
			return callback(err);
		}
		error.dumpDebugData('vpf', '01-first.page', body, 'html');

		// starts the download, assuming we have a logged session.
		var download = function(body) {
			var m;
			if (body.match(/<h1[^>]*>Sorry, you don't have permission for that/i)) {
				m = body.match(/<p class='ipsType_sectiontitle'>\s*([^<]+)/gi);
				logger.log('error', '[vpf] Unexpected return while fetching download page: "%s"', m[1]);
				return callback('Error in download page, see log.');
			}

			that.emit('downloadPreparing', { reference: transfer });
			if (m = body.match(/<a\s+href='([^']+)'\s+class='download_button[^']*'>/i)) {
				var confirmUrl = m[1].replace(/&amp;/g, '&');
				logger.log('info', '[vpf] Getting confirmation page at %s...', confirmUrl);
				// fetch the "confirm" page, where the actual link is
				request({ url: confirmUrl, jar: true }, function(err, response, body) {
					error.dumpDebugData('vpf', '02-confirmation', body, 'html');

					if (err) {
						return callback(err);
					}
					// can be multiple, they are sorted by date ascending, so latest is last item.
					var regex = new RegExp('<a\\s+href=\'([^\']+)\'\\s+class=\'download_button[^\']*\'>\\s*Download\\s*<\\/a>[\\s\\S]*?<strong\\s+class=\'name\'>([^<]+)', 'gi');
					var link = false;
					while (m = regex.exec(body)) {
						link = m;
					}
					if (link) {
						var downloadUrl = link[1].replace(/&amp;/g, '&');
						var filename = link[2].trim().replace(/\s/g, '.').replace(/[^\w\d\.\-]/gi, '');
						var dest = settings.pind.tmp + '/' + filename;
						var failed = false;

						that.emit('downloadStarted', { filename: filename, destpath: dest, reference: transfer });
						logger.log('info', '[vpf] Downloading %s at %s...', filename, downloadUrl);
						var stream = fs.createWriteStream(dest);
						stream.on('close', function() {

							var fd = fs.openSync(dest, 'r');
							var size = fs.fstatSync(fd).size;
							fs.closeSync(fd);
							watcher.unWatchDownload(dest);

							// check for failed flags
							if (failed || size < 128000) {
								var data = fs.readFileSync(dest, 'utf8');
								if (data.match(/You have exceeded the maximum number of downloads allotted to you for the day/i)) {
									logger.log('info', '[vpf] Download data is error message, quitting.', { size: size, dest: dest });
									err = 'Number of daily downloads exceeded at VPF.';
									that.emit('downloadFailed', { message: err });
									return callback(err);
								}
								if (data.match(/You may not download any more files until your other downloads are complete/i)) {
									logger.log('info', '[vpf] Too many simulataneous downloads, quitting.', { size: size, dest: dest });
									err = 'Number of concurrent downloads exceeded at VPF.';
									that.emit('downloadFailed', { message: err });
									return callback(err);
								}
								if (failed) {
									logger.log('info', '[vpf] Download failed, see %s what went wrong.', dest);
									err = 'Download failed.';
									that.emit('downloadFailed', { message: err });
									return callback(err);
								}
							}

							that.emit('downloadCompleted', { size: size, reference: transfer });
							logger.log('info', '[vpf] Downloaded %d bytes to %s.', size, dest);

							callback(null, dest);
						});
						request({ url: downloadUrl, jar: true }).on('response', function(response) {

							if (response.statusCode != 200) {
								failed = true;
								logger.log('error', '[vpf] Download failed with status code %s.', response.statusCode);
								return;
							}
							if (response.headers['content-length']) {
								that.emit('contentLengthReceived', { contentLength: response.headers['content-length'], reference: transfer });
								watcher.watchDownload(dest, response.headers['content-length'], transfer);
							}
							if (response.headers['content-disposition']) {
								var filename = response.headers['content-disposition'].match(/filename="([^"]+)"/i)[1];
								that.emit('filenameReceived', { filename: filename, reference: transfer });
							}
						}).pipe(stream);

					} else {
						var f = error.dumpDebugData('vpf', 'confirm.page', body, 'html');
						logger.log('error', '[vpf] Error parsing download button, see %s for content body.', f);
						callback('Cannot find file download button at ' + confirmUrl);
					}
				});
			} else {
				var f = error.dumpDebugData('vpf', 'download.page', body, 'html');
				logger.log('error', '[vpf] Error parsing download button, see %s for content body.', f);
				callback('Cannot find confirmation download button at ' + transfer.url);
			}
		};

		// check if need to login
		if (body.match(/<a href='[^']+' title='Sign In' id='sign_in'>Sign In/i)) {

			if (loggingIn) {
				logger.log('info', '[vpf] Waiting for current login to complete...');
				that.once('loginCompleted', function() {
					logger.log('info', '[vpf] Login completed, let\'s go!');
					download(body);
				});
				that.once('loginFailed', function(result) {
					return callback('Error logging in: ' + result.error);
				});

			} else {
				logger.log('info', '[vpf] Seems we need to login first.');
				that._login(function(err) {
					if (err) {
						return callback(err);
					}
					download(body);
				});
			}

		} else {
			logger.log('info', '[vpf] Looks like we\'re already logged in.');
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
VPForums.prototype._matchResults = function(results, title, trimFct, maxDistance) {

	var matches = [];
	var distance = maxDistance ? maxDistance : 10;
	for (var i = 0; i < results.length; i++) {
		var result = results[i];
		var name = trimFct(result.title);
		var d = natural.LevenshteinDistance(title.toLowerCase(), name.toLowerCase());
		//logger.log('info', '%s %s - %s', d, title, name);
		if (d < distance) {
			matches = [ result ];
			distance = d;
		} else if (d == distance) {
			matches.push(result);
		}
	}
	return matches;
};

/**
 * Finds the best single match for a list of results.
 * @param results Results from #_fetchDownloads()
 * @param title Title to match against
 * @param trimFct Trims off title of results for better matches
 * @param strategy How to determine best match on tie. Valid values: "latest", "mostDownloaded", "mostViewed". Default "intelligent".
 */
VPForums.prototype._matchResult = function(results, title, trimFct, strategy) {
	//noinspection JSCheckFunctionSignatures
    var matches = this._matchResults(results, title, trimFct);
	logger.log('info', 'Got matches: %j', matches, {});
	matches.sort(function(a, b) {
		var x;
		//noinspection FallthroughInSwitchStatementJS
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
};

/**
 * Retrieves all downloadable items for a given category and letter. This is a
 * cached operation, items are only downloaded the first time.
 *
 * Article URL:    http://www.vpforums.org/index.php?app=downloads&showfile=6527
 * Thumb URL:      http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&record=11988&id=6527
 * Full image URL: http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&record=11988&id=6527&full=1
 * "record" param seems unnecessary.
 *
 * @todo Cache invalidation
 * @param cat VPF category
 * @param title Title of the item. If not null, only items starting with the same letter will be returned.
 * @param options Object containing additional options: <tt>forceUpdate</tt> (boolean), <tt>firstPageOnly</tt> (boolean), <tt>sortKey</tt> (string), <tt>sortOrder</tt> (asc/desc)
 * @param callback Callback.
 */
VPForums.prototype._fetchDownloads = function(cat, title, options, callback) {

	var firstPageOnly = false;
	var currentCache = {};
	var started = new Date().getTime();
	var that = this;

	/**
	 * Saves or creates cache entries.
	 * @param cat category
	 * @param letter first letter of title
	 * @param items items to cache
	 * @param cb Callback function.
	 */
	var saveToCache = function(cat, letter, items, cb) {
		var cacheStarted = new Date().getTime();

		// update cache
		if (letter) {
			logger.log('info', '[vpf] Updating cache for letter "%s"...', letter);
		} else {
			logger.log('info', '[vpf] Updating cache...');
		}
		var results = [];
		var ids = [];
		var firstUpdated = null;
		async.eachSeries(items, function(item, next) {
			var l;
			if (!letter) {
				if (item.title.match(/^\d/)) {
					l = '0';
				} else {
					l = item.title[0].toLowerCase();
				}
			} else {
				l = letter.toLowerCase();
			}
			var obj = {
				category: cat,
				letter: l,
				title: item.title,
				fileId: item.fileId,
				downloads: item.downloads,
				views: item.views,
				author: item.author,
				lastUpdatedAt: new Date(item.updated)
			};

			var done = function(err, r) {
				if (err) {
					logger.log('error', '%s: %j', err, obj, {});
					return next(err);
				}
				if (!firstUpdated || firstUpdated.getTime() > new Date(r.lastUpdatedAt).getTime()) {
					firstUpdated = new Date(r.lastUpdatedAt);
				}
				ids.push(r.id);
				results.push(r.map());
				next();
			};
			if (currentCache[item.fileId]) {
				currentCache[item.fileId].updateAttributes(obj).done(done);
			} else {
				schema.VpfFile.create(obj).done(done);
			}

		}, function(err) {
			if (err) {
				return cb(err);
			}
			var cacheFinished = +new Date();

			// check for zombies (i.e. entries that are in the db but have been removed at vpf)
			schema.VpfFile.all({ where: ['id NOT IN (' + ids.join(',') + ') AND lastUpdatedAt > ?', firstUpdated ] }).success(function(rows) {
				async.eachSeries(rows, function(row, next) {
					var r = row.map();
					logger.log('info', '[vpf] Looks like "%s" was removed at VPF, checking...', row.title);
					request(r.url, function(err, response, body) {
						if (body.match(/we could not find the file specified/i)) {
							logger.log('info', '[vpf] Deleted "%s" from database, confirmed non-existant at VPF.', row.title);
							row.destroy().success(next);
						} else {
							logger.log('info', '[vpf] Unconfirmed, check manually and update regex.', row.title);
							next();
						}
					});
				}, function() {
					logger.log('info', '[vpf] Saved %d results to cache in %s seconds.', results.length, Math.round((cacheFinished - cacheStarted) / 100) / 10);
					cb(null, results);
				});
			});
		});

	};

	/**
	 * Recursive function that fetches items from vpforums.org.
	 * @param cat category
	 * @param letter first letter of title
	 * @param currentResult result array to add items to
	 * @param page Which page to fetch, first starts with 1.
	 * @param callback Callback function.
	 */
	var fetch = function(cat, letter, currentResult, page, callback) {
		var numPages;
		var url;
		var num = 25;
		var sortKey = 'sort_key=' + (options.sortKey ? options.sortKey : 'file_name');
		var sortOrder = 'sort_order=' + (options.sortOrder ? options.sortOrder : 'ASC');
		if (letter) {
			url = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=categoryletters&cat=' + cat + '&letter=' + letter + '&' + sortOrder + '&' + sortKey + '&num=' + num + '&st=' + ((page - 1) * num);
			logger.log('info', '[vpf] Fetching page %d for category %s and letter "%s".', page, cat, letter);
		} else {
			url = 'http://www.vpforums.org/index.php?app=downloads&showcat=' + cat + '&' + sortOrder + '&' + sortKey + '&num=' + num + '&st=' + ((page - 1) * num);
			logger.log('info', '[vpf] Fetching page %d for category %s.', page, cat);
		}

		request(url, function(err, response, body) {
			if (err) {
				logger.log('error', '[vpf] Error retrieving %s: %s', url, err);
				return callback('Error retrieving ' + url + ': ' + err);
			}
			var m;
			if (m = body.match(/<li class='pagejump[^']+'>\s+<a[^>]+>Page \d+ of (\d+)/i)) {
				numPages = m[1];
			} else {
				//var debugFile = error.dumpDebugData('vpf', 'no-numpage', body, 'html');
				//logger.log('info', '[vpf] Could not parse number of pages at ' + url + '. See ' + debugFile);
				logger.log('info', '[vpf] Could not parse number of pages, assuming one page only.');
				numPages = 1;
			}

			// initialize jquery on result
			var $ = jquery.create(jsdom(body).createWindow());
			var today = new Date();
			today.setHours(0);today.setMinutes(0);today.setSeconds(0);today.setMilliseconds(0);
			async.eachSeries($('.idm_category_row'), function(that, next) {

				var fileinfo = $(that).find('.file_info').html().match(/([\d,]+)\s+downloads\s+\(([\d,]+)\s+views/i);
				var url = $(that).find('h3.ipsType_subtitle a').attr('href').replace(/s=[a-f\d]+&?/gi, '');
				var dateString = $(that).find('.file_info .date').html().trim().replace(/^added|^updated|,/gi, '').trim();
				var dateParsed = chrono.parse(dateString, today);
				if (dateParsed.length == 0) {
					logger.log('warn', '[vpf] Could not parse date "%s".', dateString);
				}

				var u = url.match(/showfile=(\d+)/i);
				// author dom is different when logged in (names are linked)
				var author = $(that).find('.basic_info .desc').html().match(/by\s+([^\s]+)/i);
				if (u) {
					currentResult.push({
						fileId: parseInt(u[1]),
						title: $(that).find('h3.ipsType_subtitle a').attr('title').replace(/^view file named\s+/ig, ''),
						downloads: parseInt(fileinfo[1].replace(/,/, '')),
						views: parseInt(fileinfo[2].replace(/,/, '')),
						updated: dateParsed.length > 0 ? dateParsed[0].startDate : null,
						author: author ? author[1] : $(that).find('.___hover___member span').html()
					});
					next();
				} else {
					logger.log('error', 'ERROR: Could not parse file ID from %s.', url);
					next('Could not parse file ID from ' + url);
				}

			}, function() {
				if (firstPageOnly || options.firstPageOnly || page >= numPages) {
					logger.log('info', '[vpf] Fetched %d items in %s seconds.', currentResult.length, Math.round((new Date().getTime() - started) / 100) / 10);
					saveToCache(cat, letter, currentResult, callback);
				} else {
					that.emit('downloadProgressUpdated', { progress: page / numPages });
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

		if (err) {
			return callback(err);
		}

		// no second guess if no title given (all results are returned anyway)
		if (!title) {
			return callback(null, result);
		}

		var words = title.trim().toLowerCase().split(' ');

		// no second guess if no title consists only of one word
		if (words.length < 2) {
			return callback(null, result);
		}

		if (words[0] == 'the' && words[0][0] != words[1][0]) {
			logger.log('info', '[vpf] Title starts with "The", let\'s fetch also letter "%s" for second word.', words[1][0]);

			// check cache first.
			schema.VpfFile.all({ where: { category: cat, letter: words[1][0] }}).success(function(rows) {
				if (rows.length == 0) {
					// if empty, launch fetch.
					fetch(cat, words[1][0], result, 1, callback);
				} else {
					var returnedRows = [];
					_.each(rows, function(row) {
						returnedRows.push(schema.VpfFile.map(row));
					});
					callback(null, result.concat(returnedRows));
				}
			});
		} else {
			callback(null, result);
		}
	};

	// ------------------------------------------------------------------------
	// code starts here
	// ------------------------------------------------------------------------

	// check cache first.
	var params = { where: { category: cat }};
	if (title) {
		params.where.letter = title[0].toLowerCase();
	}
	schema.VpfFile.all(params).success(function(rows) {

		if (rows.length == 0) {
			// if empty, launch fetch.
			fetch(cat, title ? title[0] : null, [], 1, goAgainOrCallback);
		} else {

			// adding additional fields
			var returnedRows = [];
			_.each(rows, function(row) {
				returnedRows.push(schema.VpfFile.map(row));
				currentCache[row.fileId] = row;
			});

			if (options.forceUpdate) {
				logger.log('info', '[vpf] Force-refreshing category %d.', cat);
				fetch(cat, title ? title[0] : null, [], 1, goAgainOrCallback);
			} else {
				if (title) {
					logger.log('info', '[vpf] Returning cached letter "%s" for category %d.', title[0], cat);
				} else {
					logger.log('info', '[vpf] Returning all cached letters for category %d.', cat);
				}
				goAgainOrCallback(null, returnedRows);
			}
		}
	});
};

/**
 * Logs the user on vpforums.org in order to obtain download permissions.
 *
 * @param callback Function to execute after completion, invoked with one argument:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
VPForums.prototype._login = function(callback) {
	if (!settings.vpforums.user || !settings.vpforums.pass) {
		return callback('Need valid credentials for vpforums.org. Please update settings-mine.js.');
	}
	loggingIn = true;
	logger.log('info', '[vpf] Logging in...');
	var that = this;
	that.emit('loginStarted', { user: settings.vpforums.user });

	// just get the index to obtain the damn auth key
	request({ url: 'http://www.vpforums.org/index.php', jar: true }, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}
		var m = body.match(/<input\s+type='hidden'\s+name='auth_key'\s+value='([^']+)/i);
		if (!m) {
			callback('Cannot find auth key in index page.');
		} else {
			logger.log('info', '[vpf] Got auth key: %s', m[1]);

			// post credentials
			request.post({
				url: 'http://www.vpforums.org/index.php?app=core&module=global&section=login&do=process',
				jar: true,
				form: {
					auth_key: m[1],
					anonymous: '1',
					referer: 'http://www.vpforums.org/index.php',
					ips_username: settings.vpforums.user,
					ips_password: settings.vpforums.pass
				}
			}, function(err, response, body) {
				loggingIn = false;
				if (err) {
					that.emit('loginFailed', { error: err, user: settings.vpforums.user });
					return callback(err);
				}

				// redirect means all ok.
				if (response.statusCode == 302) {
					logger.log('info', '[vpf] Login successful.');
					that.emit('loginCompleted', { user: settings.vpforums.user });
					return callback();
				}

				if (body.match(/username or password incorrect/i)) {
					err = 'Wrong credentials, check your settings-mine.js.';
					that.emit('loginFailed', { error: err, user: settings.vpforums.user });
					return callback(err);
				}

				that.emit('loginFailed', { error: 'Unexpected response', body: body, response: response, user: settings.vpforums.user });
				callback('Unexpected response: ' + body);
			})
		}
	});
};

/**
 * Destroys the current VPF session. Typically called after longish fetching
 * routines.
 *
 * @param callback Function to execute after completion, invoked with one argument:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
VPForums.prototype.logout = function(callback) {
	// fetch another damn id
	logger.log('info', '[vpf] Logging out...');
	request({ url: 'http://www.vpforums.org/index.php', jar: true }, function(err, response, body) {
		if (err) {
			return callback(err);
		}
		var m;
		if (m = body.match(/<a\shref="([^"]+do=logout[^"]+)/)) {
			request(m[1], function(err) {
				if (err) {
					callback(err);
				} else {
					logger.log('info', '[vpf] Logout successful.');
					callback();
				}
			});
		} else {
			callback('It looks like the nobody is logged in the current VPF session.');
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
VPForums.prototype.cacheAllTableDownloads = function(callback) {

	if (isCreatingIndex || isDownloadingIndex) {
		return callback('Fetching process already running. Wait until complete.');
	}
	isCreatingIndex = true;
	var that = this;
	that.emit('createIndexStarted');

	this._fetchDownloads(41, null, {}, function(err, results) {
		isCreatingIndex = false;
		if (err) {
			that.emit('createIndexFailed', { error: err });
			callback(err);
			return logger.log('error', 'ERROR: %s', err);
		}
		that.emit('createIndexCompleted');
		callback(null, results);
	});
};

/**
 * Fetches only latest page of downloads in the "VP cabinet tables" section (and
 * automatically caches them).
 *
 * @param callback
 */
VPForums.prototype.cacheLatestTableDownloads = function(callback) {

	if (isCreatingIndex || isDownloadingIndex) {
		return callback('Fetching process already running. Wait until complete.');
	}
	var that = this;
	isDownloadingIndex = true;
	that.emit('refreshIndexStarted');

	this._fetchDownloads(41, null, {
		forceUpdate : true,
		firstPageOnly: true,
		sortKey: 'file_updated',
		sortOrder: 'desc'
	}, function(err, results) {
		isDownloadingIndex = false;
		if (err) {
			that.emit('refreshIndexFailed', { error: err });
			callback(err);
			return logger.log('error', 'ERROR: %s', err);
		}
		that.emit('refreshIndexCompleted');
		callback(null, results);
	});
};

VPForums.prototype.isDownloadingIndex = function() {
	return isDownloadingIndex;
};

VPForums.prototype.isCreatingIndex = function() {
	return isCreatingIndex;
};

module.exports = new VPForums();
