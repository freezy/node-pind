'use strict';

var _ = require('underscore');
var fs = require('fs');
var ent	 = require('ent');
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
var transferring = [];
var aborting = false;

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
	an.notice(this, 'romSearchStarted', 'VPF: Searching ROM for "{{name}}"', 'admin', 120000);

	// fetchDownloads()
	an.forward(this, 'downloadProgressUpdated', ns, 'admin');

	// download()
	an.notice(this, 'downloadInitializing', 'VPF: Initializing download {{fileinfo}}', 'admin', 60000);
	an.notice(this, 'downloadPreparing', 'VPF: Preparing download', 'admin', 60000);
	an.notice(this, 'downloadStarted', 'VPF: Downloading "{{filename}}"', 'admin', 300000);
	an.notice(this, 'downloadCompleted', 'VPF: {{size}} bytes downloaded.', 'admin');
	an.notice(this, 'downloadFailed', 'VPF: Download failed: {{message}}', 'admin');

	// login()
	an.notice(this, 'loginStarted', 'VPF: Logging in as "{{user}}"', 'admin', 30000);

	// index
	an.data(this, 'createIndexStarted',    { id: 'crvpfindex' }, ns, 'admin');
	an.data(this, 'createIndexCompleted',  { id: 'crvpfindex' }, ns, 'admin');
	an.data(this, 'createIndexCompleted',  {}, ns, 'admin', 'indexUpdated');
	an.data(this, 'refreshIndexStarted',   { id: 'dlvpfindex' }, ns, 'admin');
	an.data(this, 'refreshIndexCompleted', { id: 'dlvpfindex' }, ns, 'admin');
	an.data(this, 'refreshIndexCompleted',  {}, ns, 'admin', 'indexUpdated');
	an.notice(this, 'downloadIndexFailed', 'Index download failed: {{error}}', 'admin');
	an.notice(this, 'downloadIndexFailed', 'Index update failed: {{error}}', 'admin');

	// "inverse" method calls
	//an.forward(this, 'queueTransfer');
};

VPForums.prototype._fixTitle = function(n) {

	var name = n;
	var r = function(regex, newName) {
		if (name.match(regex)) {
			name = newName;
		}
	};

	// short names
	r(/tommy pinball wizard/i, 'Tommy The Pinball Wizard');

	return name;
};

/**
 * Finds and downloads either a media pack or a table video.
 *
 * Media must match the edition (i.e. nightmod/standard), otherwise no result
 * is returned.
 *
 * @param cat VPF category
 * @param table Table of the media pack
 * @param ref_parent ID of transfer, in case of a post action
 * @param what Enum for transfer table
 * @param filter A regex that discards entries when matched.
 * @param callback Function to execute after completion, invoked with one argument:
 * 	<ol><li>{String} Error message on error</li></ol>
 */
VPForums.prototype._findMedia = function(table, ref_parent, cat, what, filter, callback) {

	var that = this;
	var queue = function(match) {
		// this will add a new transfer.
		that.emit('queueTransfer', {
			title: match.title,
			url: 'http://www.vpforums.org/index.php?app=downloads&showfile=' + match.fileId,
			type: what,
			engine: 'vpf',
			ref_src: match.id,
			ref_parent: ref_parent
		});
		callback(null, { found: true });
	};
	var searchByName = function() {
		var searchName = that._fixTitle(table.name);
		that._fetchDownloads(cat, searchName, {}, function(err, results) {
			if (err) {
				logger.log('error', '[vpf] Error fetching downloads: %s', err);
				return callback(err);
			}
			// results must match edition of table
			results = _.filter(results, function(result) {
				//if (result.edition != table.edition) {
				//	logger.log('info', '[vpf] Removing "%s", not matching edition (is %s, should be %s).', result.title, result.edition, table.edition);
				//}
				return result.edition == table.edition;
			});
			var match = VPForums.prototype._matchResult(results, searchName, function(str) {
				return str.replace(/[\[\(].*|rev\d.*/i, '').trim();
			}, filter, 'intelligent');
			if (!match) {
				logger.log('warn', '[vpf] Cannot find any %s edition media with name similar to "%s".', table.edition, searchName);
				return callback(null, { found: false });
			}
			queue(match);
		});
	};

	logger.log('info', '[vpf] Searching %s for "%s"', what, table.name);
	if (table.ipdb_no) {
		schema.VpfFile.all({ where: {
			edition: table.edition,
			ipdb_id: table.ipdb_no,
			category: cat
		}}).then(function(rows) {
			logger.log('info', '[vpf] Trying match by IPDB...');
			if (rows.length > 0) {
				rows.sort(function(a, b) {
					if (a.edition != b.edition) {
						return table.edition == a.edition ? -1 : 1;
					}
					return a.downloads > b.downloads ? -1 : 1;
				});
				logger.log('info', '[vpf] Found %d match(es) for %s (%s) - %d:', rows.length, table.name, table.edition, table.ipdb_no);
				_.each(rows, function(row, i) {
					logger.log('info', '[vpf]   %d. %s (%s)', i, row.title, row.edition)
				});
				queue(rows[0]);
			} else {
				logger.log('info', '[vpf] No match found by IPDB number, searching by name.');
				searchByName();
			}
		});
	} else {
		searchByName();
	}

};

/**
 * Finds a media pack and downloads it.
 * @param table Table of the media pack
 * @param ref_parent ID of transfer, in case of a post action
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Success message from transfer.</li></ol>
 */
VPForums.prototype.findMediaPack = function(table, ref_parent, callback) {
	if (table.platform == 'VP') {
		this._findMedia(table, ref_parent, 35, 'mediapack', null, callback);
	} else {
		this._findMedia(table, ref_parent, 36, 'mediapack', null, callback);
	}
};

/**
 * Finds a table video and downloads it.
 * @param table Table of the media pack
 * @param ref_parent ID of transfer, in case of a post action
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{String} Absolute file path of the downloaded archive.</li></ol>
 */
VPForums.prototype.findTableVideo = function(table, ref_parent, callback) {
	var filter = /dmd\s*video/i;
	if (table.platform == 'VP') {
		this._findMedia(table, ref_parent, 43, 'video', filter, callback);
	} else {
		this._findMedia(table, ref_parent, 34, 'video', filter, callback);
	}
};

/**
 * Returns a list of links to all ROM files for a given table.
 *
 * The matching is a bit more complicated as usual:
 *   - Search queries firstly got through _fixTitle() as usual, but only for knowning which letter
 *     to fetch.
 *   - If a match can be made by the ROM name, which is the description at VPF for ROM downloads,
 *     read the search name from there.
 *
 * @param table Row from tables database.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of found links. Links are objects with <tt>title</tt>, <tt>filename</tt> and <tt>url</tt>.</li></ol>
 */
VPForums.prototype.getRomLinks = function(table, callback) {

	var that = this;
	var searchName = that._fixTitle(table.name);
	logger.log('info', '[vpf] Searching ROM for "%s"...', searchName);
	this.emit('romSearchStarted', { name: searchName });
	that._fetchDownloads(9, searchName, {}, function(err, results) {
		if (err) {
			return callback(err);
		}
		var i;
		var trimFct = function(str) {
			return str.replace(/[\[\(\-].*/, '').trim();
		};

		// now, try to match by description (which contains the file name) first.
		var matchedResult;
		if (table.rom) {
			for (i = 0; i < results.length; i++) {
				var result = results[i];
				var d = result.description.toLowerCase();
				if (d.substr(0, d.lastIndexOf('.')) == table.rom) {
					logger.log('info', '[vpf] Matched "%s" by ROM name "%s".', result.title, table.rom);
					matchedResult = result;
					break;
				}
			}
		}

		// if match has been made, trim the match's title and use it for a second search.
		if (matchedResult) {
			searchName = trimFct(matchedResult.title);
			logger.log('info', '[vpf] Using "%s" for final matching.', searchName);
		}

		//noinspection JSCheckFunctionSignatures
        var matches = VPForums.prototype._matchResults(results, searchName, trimFct);
		var links = [];
		for (i = 0; i < matches.length; i++) {
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
	aborting = false;

	that.emit('downloadInitializing', { reference: transfer, fileinfo: transfer.filename ? ' for "' + transfer.filename + '"' : '' });

	// fetch the "overview" page
	request({ url: transfer.url, jar: true }, function(err, response, body) {
		if (err) {
			return callback(err);
		}
		if (aborting) {
			logger.log('info', '[vpf] Aborting overview download.');
			return callback();
		}
		//error.dumpDebugData('vpf', '01-first.page', body, 'html');

		/**
		 * Starts the download, assuming we have a logged session.
		 * @param body HTML body of initial download page.
		 */
		var download = function(body) {
			var m;
			if (aborting) {
				logger.log('info', '[vpf] Aborting download.');
				return callback();
			}
			if (body.match(/<h1[^>]*>Sorry, you don't have permission for that/i)) {
				m = body.match(/<p class='ipsType_sectiontitle'>\s*([^<]+)/gi);
				logger.log('error', '[vpf] Unexpected return while fetching download page: "%s"', m[1]);
				return callback('Error in download page, see log.');
			}

			that.emit('downloadPreparing', { reference: transfer });
			if (m = body.match(/<a\s+href='([^']+)'\s+class='download_button[^']*'>/i)) {

				/**
				 * Like "request", but with two callbacks:
				 * 	- One for "text" responses, where no "Content-Disposition" header is provided
				 * 	- One for "binary" responses, where "Content-Disposition" header is provided
				 *
				 * The first returns the body directly, while the latter only provides the res object
				 * which can be used for streaming.
				 *
				 * @param options Options passed to "request()"
				 * @param txtFct
				 * @param binFct
				 */
				var reqTxtOrBin = function(options, txtFct, binFct) {

					var req = request(options);
					req.on('response', function(response) {


						// stream to file
						if (response.statusCode == 200 && response.headers['content-disposition']) {
							var m = response.headers['content-disposition'].match(/filename="([^"]+)"/i);
							var filename;
							if (m) {
								filename = m[1];
							} else {
								filename = response.headers['content-disposition'].substr(response.headers['content-disposition'].toLowerCase().indexOf('filename'));
								filename = filename.trim().replace(/\s/g, '.').replace(/[^\w\d\.\-]/gi, '');
								logger.log('warn', '[vpf] Messed up Content-Disposition "%s", taking whole string "%s".', response.headers['content-disposition'], filename);
							}
							that.emit('filenameReceived', { filename: filename, reference: transfer });

							if (response.headers['content-length']) {
								that.emit('contentLengthReceived', { contentLength: response.headers['content-length'], reference: transfer });
							}
							binFct(response, filename, response.headers['content-length'], options.url);

						// stream to memory
						} else {
							var chunks = [];
							response.on('data', function(chunk) {
								chunks.push(chunk);
							});

							response.on('end', function() {
								var buffer = Buffer.concat(chunks);
								txtFct(null, response, buffer.toString());
							});
						}
					});

					req.on('error', function(err) {
						logger.log('error', '[vpf] Error fetching: ', err.message);
						txtFct(err.message);
					});
				};

				/**
				 * Streams a download to disk.
				 *
				 * @param res
				 * @param filename
				 * @param size
 				 * @param url
				 */
				var downloadFile = function(res, filename, size, url) {

					var watching = false;
					var dest = settings.pind.tmp + '/' + filename;

					that.emit('downloadStarted', { filename: filename, destpath: dest, reference: transfer });
					logger.log('info', '[vpf] Downloading %s at %s...', filename, url);
					var stream = fs.createWriteStream(dest);
					stream.on('close', function() {

						var fd = fs.openSync(dest, 'r');
						var size = fs.fstatSync(fd).size;
						fs.closeSync(fd);
						watcher.unWatchDownload(dest);

						that.emit('downloadCompleted', { size: size, reference: transfer });
						logger.log('info', '[vpf] Downloaded %d bytes to %s.', size, dest);

						// remove from transferring array
						transferring.splice(transferring.indexOf(res), 1);

						callback(null, dest);
					});
					res.on('data', function() {
						if (!watching) {
							// register watcher
							watching = watcher.watchDownload(dest, size, transfer);
						}
					});
					res.pipe(stream);

					// add to transferring array so we can stop/pause it
					transferring.push(res);
				};

				var confirmUrl = m[1].replace(/&amp;/g, '&');
				logger.log('info', '[vpf] Getting confirmation page at %s...', confirmUrl);

				/*
				 * The "confirmation page" can also directly return file data. That means we have to look at the headers
				 * in order to determine if the returned data is the confirmation page or not.
				 */
				reqTxtOrBin({ url: confirmUrl, jar: true }, function(err, response, body) {

					// check status code
					if (response.statusCode !== 200) {
						logger.log('error', '[vpf] Status code is %d instead of 200 when downloading confirmation page.', response.statusCode);
						error.dumpDebugData('vpf', 'http-code-' + response.statusCode, body, 'html');
						return callback('Wrong HTTP status code, got ' + response.statusCode + ' instead of 200.');
					}

					//error.dumpDebugData('vpf', '02-confirmation', body, 'html');

					if (aborting) {
						logger.log('info', '[vpf] Aborting request.');
						return callback();
					}
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

						reqTxtOrBin({ url: downloadUrl, jar: true }, function(err, response, body) {

							if (err) {
								return callback(err);
							}

							if (body.match(/You have exceeded the maximum number of downloads allotted to you for the day/i)) {
								logger.log('warn', '[vpf] Download limit per day reached, aborting.');
								err = 'Number of daily downloads exceeded at VPF.';
								that.emit('downloadFailed', { message: err });
								return callback(err);
							}
							if (body.match(/You may not download any more files until your other downloads are complete/i)) {
								logger.log('warn', '[vpf] Too many simulataneous downloads, quitting.');
								err = 'Number of concurrent downloads exceeded at VPF.';
								that.emit('downloadFailed', { message: err });
								return callback(err);
							}
							if (response.statusCode !== 200) {
								logger.log('error', '[vpf] Status code is %d instead of 200 when downloading data.', response.statusCode);
								error.dumpDebugData('vpf', 'http-code-' + response.statusCode, body, 'html');
								that.emit('downloadFailed', { message: err });
								return callback('Wrong HTTP status code, got ' + response.statusCode + ' instead of 200.');
							}

						}, downloadFile);

					} else {
						var f = error.dumpDebugData('vpf', 'confirm.page', body, 'html');
						logger.log('error', '[vpf] Error parsing download button, see %s for content body.', f);
						callback('Cannot find file download button at ' + confirmUrl);
					}
				}, downloadFile);


			} else {
				var f = error.dumpDebugData('vpf', 'download.page', body, 'html');
				logger.log('error', '[vpf] Error parsing download button, see %s for content body.', f);
				callback('Cannot find confirmation download button at ' + transfer.url);
			}
		};

		var initDownload = function(body) {

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
		};

		// update description
		jsdom.env({
			html: body,
			done: function(err, window) {
				if (err) {
					logger.log('warn', 'Error loading result into DOM: %s', err);
					return initDownload(body);
				}
				var $ = jquery.create(window);
				var description = $('div.ipsType_textblock.description_content').html();
				if (description && transfer.ref_src) {
					logger.log('info', '[vpf] Updating description for download %s', transfer.ref_src);
					schema.VpfFile.find(transfer.ref_src).then(function(row) {
						if (row) {
							row.updateAttributes({
								description: ent.decode(description).trim()
							}, [ 'description' ]).then(function(row) {
								that.emit('descriptionUpdated', { transfer: transfer, vpf_file: row });
								initDownload(body);
							});
						} else {
							initDownload(body);
						}
					});
				} else {
					initDownload(body);
				}
			}
		});
	});
};

VPForums.prototype.abortDownloads = function() {
	aborting = true;
	logger.log('info', '[vpf] Aborting %d transfer(s).', transferring.length);
	_.each(transferring, function(req) {
		req.abort();
	});
	transferring = [];
};

/**
 * Finds the best matches for a list of results (typically all items of a letter).
 * Returns all matches if Levenshtein distance is equal for best matches.
 *
 * @param results Result from #fetchDownloads()
 * @param title Title to match against
 * @param trimFct Trims off title of results for better matches
 * @param maxDistance Maximal Lebenshtein Distance to original name.
 * @param filter Regex if matched skips entry
 * @returns {Array}
 */
VPForums.prototype._matchResults = function(results, title, trimFct, filter, maxDistance) {

	var matches = [];
	var distance = maxDistance ? maxDistance : 10;
	var nameToMatch = trimFct(title).toLowerCase();
	logger.log('info', '[vpf] Matching %d items against "%s"..', results.length, nameToMatch);
	for (var i = 0; i < results.length; i++) {
		var result = results[i];
		if (filter && result.title.match(filter)) {
			logger.log('info', ' [vpf] Filtered out entry "%s".', result.title);
			continue;
		}
		var name = trimFct(result.title);
		var d = natural.LevenshteinDistance(nameToMatch, name.toLowerCase());
		//logger.log('info', '[vpf]   %s %s - %s', d, nameToMatch, name);
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
 * @param filter Regex if matched skips entry.
 */
VPForums.prototype._matchResult = function(results, title, trimFct, filter, strategy) {
	//noinspection JSCheckFunctionSignatures
    var matches = this._matchResults(results, title, trimFct, filter);
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

	var i = 0;
	logger.log('info', '[vpf] Matches sorted by accuracy:');
	_.each(matches, function(match) {
		logger.log('info', '[vpf]   %d. %s (%s - %d views, %d downloads)', ++i, match.title, match.lastUpdatedSince, match.views, match.downloads);
	});

	return matches[0];
};

/**
 * Returns all cabinet downloads from VFP
 * @param title If provided returns only downloads starting with that letter.
 * @param callback
 */
VPForums.prototype.getTables = function(title, callback) {
	this._fetchDownloads(41, title, {}, callback);
};

VPForums.prototype.getIpdbMap = function() {
	return JSON.parse(fs.readFileSync(__dirname + '/../data/ipdb-vpf.json', 'utf8'));
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
 * @param options Object containing additional options:
 * 		<li><tt>forceUpdate</tt> (boolean) - Fetch from VPF even if local cache available</li>
 * 		<li><tt>firstPageOnly</tt> (boolean) - Stop after first page</li>
 * 		<li><tt>sortKey</tt> (string) - How to request sorting at VPF</li>
 * 		<li><tt>sortOrder</tt> (asc/desc) - Which sort direction at VPF</li>
 * 		<li><tt>progress</tt> (total/num/ignore) - If total and num are set, progress doesn't go from 0 to 1 but 0 to 1/total (depending on num)</li>
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
			logger.log('info', '[vpf] Updating cache for category %s / letter "%s"...', cat, letter);
		} else {
			logger.log('info', '[vpf] Updating cache...');
		}
		var results = [];
		var ids = [];
		var firstUpdated = null;
		var map = that.getIpdbMap();
		async.eachSeries(items, function(item, next) {
			var l;
			if (!letter) {
				l = getLetter(item.title);
			} else {
				l = letter.toLowerCase();
			}
			var obj = {
				category: cat,
				letter: l,
				title: item.title,
				description: item.description,
				fileId: item.fileId,
				downloads: item.downloads,
				views: item.views,
				author: item.author,
				lastUpdatedAt: new Date(item.updated)
			};

			if (map[item.fileId]) {
				if (map[item.fileId].type && map[item.fileId].type == 'OG') {
					obj.ipdb_id = -1;
				} else {
					obj.ipdb_id = map[item.fileId].ipdb;
				}
			}

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
				obj.edition = schema.Table.getEdition(obj.title);
				schema.VpfFile.create(obj).done(done);
			}

		}, function(err) {
			if (err) {
				return cb(err);
			}
			var cacheFinished = +new Date();

			var done = function() {
				logger.log('info', '[vpf] Saved %d results to cache in %s seconds.', results.length, Math.round((cacheFinished - cacheStarted) / 100) / 10);
				cb(null, results);
			};

			if (ids.length == 0) {
				return done();
			}

			// check for zombies (i.e. entries that are in the db but have been removed at vpf)
			if (cacheStarted - firstUpdated.getTime() > 5184000000) { // max age 2 months
				firstUpdated = new Date(cacheStarted - 5184000000);
			}
			var query;
			if (letter) {
				query = 'id NOT IN (' + ids.join(',') + ') AND category = ' + cat + ' AND letter = "' + letter + '" AND lastUpdatedAt > ?';
			} else {
				query = 'id NOT IN (' + ids.join(',') + ') AND category = ' + cat + ' AND lastUpdatedAt > ?';
			}
			schema.VpfFile.all({ where: [ query, firstUpdated ] }).then(function(rows) {
				async.eachSeries(rows, function(row, next) {
					var r = row.map();
					logger.log('info', '[vpf] Looks like "%s" was removed at VPF, checking at %s', row.title, r.url);
					request(r.url, function(err, response, body) {
						if (body.match(/we could not find the file specified/i)) {
							logger.log('info', '[vpf] Deleted "%s" from database, confirmed non-existant at VPF.', row.title);
							row.destroy().then(next);
						} else {
							logger.log('info', '[vpf] Unconfirmed, check manually and update regex.', row.title);
							next();
						}
					});
				}, done);
			});
		});

	};

	/**
	 * Recursive function that fetches items from vpforums.org.
	 * @param opt Contains parameters:
	 * 		<li><tt>cat</tt> - category</li>
	 * 		<li><tt>letter</tt> - first letter of title</li>
	 * 		<li><tt>page</tt> - which page to fetch, first starts with 1.
	 * @param currentResult result array to add items to
	 * @param callback Callback function.
	 */
	var fetch = function(opt, currentResult, callback) {
		var numPages;
		var url;
		var num = 25;
		var sortKey = 'sort_key=' + (options.sortKey ? options.sortKey : 'file_name');
		var sortOrder = 'sort_order=' + (options.sortOrder ? options.sortOrder : 'ASC');
		if (opt.letter) {
			url = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=categoryletters&cat=' + opt.cat + '&letter=' + opt.letter + '&' + sortOrder + '&' + sortKey + '&num=' + num + '&st=' + ((opt.page - 1) * num);
			logger.log('info', '[vpf] Fetching page %d for category %s and letter "%s".', opt.page, opt.cat, opt.letter);
		} else {
			url = 'http://www.vpforums.org/index.php?app=downloads&showcat=' + opt.cat + '&' + sortOrder + '&' + sortKey + '&num=' + num + '&st=' + ((opt.page - 1) * num);
			logger.log('info', '[vpf] Fetching page %d for category %s.', opt.page, opt.cat);
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
			// update description
			jsdom.env({
				html: body,
				done: function(err, window) {
					if (err) {
						logger.log('warn', 'Error loading result into DOM: %s', err);
						return initDownload(body);
					}
					var $ = jquery.create(window);
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
						var descr = $(that).find('span[class="desc"]').html();
						if (u) {
							currentResult.push({
								fileId: parseInt(u[1]),
								title: $(that).find('h3.ipsType_subtitle a').attr('title').replace(/^view file named\s+/ig, ''),
								description: descr ? ent.decode(descr).trim() : '',
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
						if (firstPageOnly || options.firstPageOnly || opt.page >= numPages) {
							logger.log('info', '[vpf] Fetched %d items in %s seconds.', currentResult.length, Math.round((new Date().getTime() - started) / 100) / 10);
							saveToCache(opt.cat, opt.letter, currentResult, callback);
						} else {

							// update progress bar
							if (options.progress) {
								if (!options.progress.ignore) {
									if (options.progress.total > 1) {
										var p = opt.page / numPages;
										that.emit('downloadProgressUpdated', { progress: (options.progress.num / options.progress.total) + (p / options.progress.total) });
									} else {
										that.emit('downloadProgressUpdated', { progress: opt.page / numPages });
									}
								}
							} else {
								that.emit('downloadProgressUpdated', { progress: opt.page / numPages });
							}

							opt.page++;
							fetch(opt, currentResult, callback);
						}
					});
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
			schema.VpfFile.all({ where: { category: cat, letter: words[1][0] }}).then(function(rows) {
				if (rows.length == 0) {
					// if empty, launch fetch.
					fetch({ cat: cat, letter: words[1][0], page: 1 }, [], function(err, resultNextLetter) {
						callback(null, result.concat(resultNextLetter));
					});
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

	var getLetter = function(title) {
		if (title) {
			if (title.match(/^\d/)) {
				return '0';
			} else {
				return title[0].toLowerCase();
			}
		}
		return null;
	};

	// ------------------------------------------------------------------------
	// code starts here
	// ------------------------------------------------------------------------


	var params = { where: { category: cat }};
	if (title) {
		params.letter = getLetter(title);
	}
	// check cache first.
	schema.VpfFile.all(params).then(function(rows) {

		if (rows.length == 0) {
			// if empty, launch fetch.
			fetch({ cat: cat, letter: getLetter(title), page: 1 }, [], goAgainOrCallback);
		} else {

			// adding additional fields
			var returnedRows = [];
			_.each(rows, function(row) {
				returnedRows.push(schema.VpfFile.map(row));
				currentCache[row.fileId] = row;
			});

			if (options.forceUpdate) {
				logger.log('info', '[vpf] Force-refreshing category %d.', cat);
				fetch({ cat: cat, letter: getLetter(title), page: 1 }, [], goAgainOrCallback);
			} else {
				if (title) {
					logger.log('info', '[vpf] Returning cached letter "%s" for category %d.', getLetter(title), cat);
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
			return callback(err);
		}
		if (aborting) {
			logger.log('info', '[vpf] Aborting login.');
			loggingIn = false;
			return callback();
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

VPForums.prototype.cacheAllDownloads = function(callback) {

	if (isCreatingIndex || isDownloadingIndex) {
		return callback('Fetching process already running. Wait until complete.');
	}
	isCreatingIndex = true;
	var that = this;
	var num = 0;
	that.emit('createIndexStarted');
	// 41 VP 9.x.x Cabinet Tables
	// 35 HyperPin Media Packs
	// 36 HyperPin Media Packs → HyperPin Media Packs for Future Pinball
	// 33 Hyperpin Videos
	// 26 Hyperpin Videos → HyperPin Preview Videos - Visual Pinball
	// 43 Hyperpin Videos → HyperPin Preview Videos - Visual Pinball → Playfield Videos - Visual Pinball
	// 47 Hyperpin Videos → HyperPin Preview Videos - Visual Pinball → Playfield Videos - Visual Pinball → Playfield Videos - Visual Pinball - Audio Enabled
	// 44 Hyperpin Videos → HyperPin Preview Videos - Visual Pinball → Backglass Videos - Visual Pinball
	// 34 Hyperpin Videos → HyperPin Preview Videos - Future Pinball
	// 45 Hyperpin Videos → HyperPin Preview Videos - Future Pinball → Playfield Videos - Future Pinball
	// 46 Hyperpin Videos → HyperPin Preview Videos - Future Pinball → Backglass Videos - Future Pinball
	var categories = [41, 36, 35, 47, 43, 44, 45, 46];
	async.eachSeries(categories, function(cat, next) {
		that._fetchDownloads(cat, null, {
/*			forceUpdate : true,
			firstPageOnly: true,
			sortKey: 'file_updated',
			sortOrder: 'desc',*/
			progress: {
				total: categories.length,
				num: num++
			}
		}, next);

	}, function(err) {
		isCreatingIndex = false;
		if (err) {
			that.emit('createIndexFailed', { error: err });
			callback(err);
			return logger.log('error', 'ERROR: %s', err);
		}
		that.emit('createIndexCompleted');
		callback();
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
VPForums.prototype.cacheLatestDownloads = function(callback) {

	if (isCreatingIndex || isDownloadingIndex) {
		return callback('Fetching process already running. Wait until complete.');
	}
	var that = this;
	isDownloadingIndex = true;
	that.emit('refreshIndexStarted');
	var categories = [41, 36, 35, 47, 43, 44, 45, 46];
	async.eachSeries(categories, function(cat, next) {
		that._fetchDownloads(cat, null, {
			forceUpdate : true,
			firstPageOnly: true,
			sortKey: 'file_updated',
			sortOrder: 'desc',
			progress: { ignore: true }
		}, next);

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
