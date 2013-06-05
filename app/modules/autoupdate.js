var _ = require('underscore');
var fs = require('fs');
var git = require('gift');
var util = require('util');
var path = require('path');
var exec = require('child_process').exec;
var async = require('async');
var unzip = require('unzip');
var events = require('events');
var semver = require('semver');
var github = require('octonode');
var mkdirp = require('mkdirp');
var uglify = require('uglify-js2');
var request = require('request');
var filesize = require('filesize');
var relativeDate = require('relative-date');

var schema = require('../model/schema');
var settings = require('../../config/settings-mine');
var version = null;

var dryRun = true;

/**
 * Manages the application self-updates.
 *
 * Notes about versioning. Releases are tagged via git. Once tag has been set,
 * the next versions will be named as the next release with the "-pre" suffix.
 * The release procedure is hence as follows:
 *
 * 		1. Commit what's to be the next version.
 * 		2. Update package.json with the next version, e.g. "0.0.6"
 * 		3. Commit the version bump:
 * 		   > git commit -a -m "New version: v0.0.6"
 * 		4. Tag the version (in the future, use an annotated tag with changelog)
 * 	 	   > git tag "v0.0.6"
 * 	 	5. Push the new version with the new tag
 *		   > git push origin master --tags
 *		6. Update package.json with next working version: "0.0.7-pre"
 *
 * @returns {AutoUpdate}
 * @constructor
 */
function AutoUpdate() {
	if ((this instanceof AutoUpdate) === false) {
		return new AutoUpdate();
	}
	events.EventEmitter.call(this);
}
util.inherits(AutoUpdate, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 * @param app Express application
 */
AutoUpdate.prototype.initAnnounce = function(app) {
	var an = require('./announce')(app, this);
	an.forward('updateAvailable');
};

/**
 * We keep a local version.json so we know which commit is exactly running.
 * This makes sure version.json is available and creates it if necessary.
 *
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 	    <li>{Object} Version object with <tt>version</tt>, <tt>date</tt> and <tt>sha</tt>.</li></ol>
 */
AutoUpdate.prototype.initVersion = function(callback) {

	var that = this;
	var packageVersion = this._getPackageVersion();
	var repo;

	// retrieve version from local git repo first (hash from .git, version from package.json)
	if (fs.existsSync(__dirname + '../../../.git')) {

		repo = git(path.normalize(__dirname + '../../../'));
		repo.commits('master', 1, function(err, commits) {
			var commit = commits[0];
			that.setVersion(commit.id, commit.committed_date, packageVersion);
			callback(null, version);
		});
		return;
	}

	// no git, so check if version.json is available.
	var v = that._readVersion();
	if (v) {
		return callback(null, v);
	}

	// no git and no version.json, so let's retrieve commit data from github.
	console.log('[autoupdate] No version.json found, retrieving data from package.json and GitHub.');
	var client = github.client();
	repo = client.repo(settings.pind.repository.user + '/' + settings.pind.repository.repo);

	// retrieve all tags from node-pind repo
	repo.tags(function(err, tagArray) {
		if (err) {
			return callback(err);
		}

		// loop through tags and try to match the one from package.json
		var tags = {};
		var olderTags = [];
		var matchedTag;
		var cleanPackageVer = semver.clean(packageVersion);
		for (var i = 0; i < tagArray.length; i++) {
			var tag = tagArray[i];
			if (semver.valid(tag.name)) {
				var cleanTagVer = semver.clean(tag.name);
				if (cleanTagVer == cleanPackageVer) {
					matchedTag = tag;
					break;
				}
				if (semver.lt(cleanTagVer, cleanPackageVer)) {
					olderTags.push(cleanTagVer);
				}
				tags[cleanTagVer] = tag;
			}
		}

		// no match. that means the local copy isn't a tagged version
		// but something like 0.0.3-pre. in this case, get the previous
		// tagged version, which would be 0.0.2.
		if (!matchedTag) {
			olderTags.sort(semver.rcompare);
			matchedTag = tags[olderTags[0]];
		}

		// retrieve commit
		that._getCommit(matchedTag.commit.url, function(err, commit) {
			that.setVersion(commit, packageVersion);
			callback(null, version);
		});
	});
};

/**
 * Returns the current version of Pind.
 * @returns {Object} Version, containing <tt>version</tt>, <tt>date</tt> and <tt>sha</tt>
 */
AutoUpdate.prototype.getVersion = function() {
	if (!version) {
		version = this._readVersion();
	}
	version.dateSince = relativeDate(version.date);
	version.url = 'https://github.com/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/commit/' + version.sha;
	return version;
};

/**
 * Writes version.json based on a commit and package version (optional)
 * @param commitSha Commit object from GitHub API | SHA hash
 * @param packageVersionDate (optional) Package version, otherwise reread from package.json. | Date
 * @param packageVersion | Package version
 * @returns {Object} Version object
 */
AutoUpdate.prototype.setVersion = function(commitSha, packageVersionDate, packageVersion) {

	// three params: sha / date / package version
	if (packageVersion) {
		version = {
			date: packageVersionDate,
			sha: commitSha,
			version: packageVersion
		};

	// two/one params: commit / package version
	} else {
		packageVersionDate = packageVersionDate ? packageVersionDate : this._getPackageVersion();
		version = {
			date: new Date(Date.parse(commitSha.commit.committer.date)),
			sha: commitSha.sha,
			version: packageVersionDate
		};
	}

	this._writeVersion(version);
	return this.getVersion();
};

/**
 * Checks if a version is availbale, depending on update settings.
 *
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 	    <li>{Object} <tt>version</tt> - Version of last commit,
 * 	                 <tt>date</tt> - Date of last commit,
 * 	                 <tt>tag</tt> - tag object from GitHub,
 * 	                 <tt>commit</tt> - commit object from GitHub (only if not bleeding edge).
 * 	    </li></ol>
 */
AutoUpdate.prototype.newVersionAvailable = function(callback) {
	if (settings.pind.updateToBleedingEdge) {
		this.newHeadAvailable(callback);
	} else {
		this.newTagAvailable(callback);
	}
};

/**
 * Updates the code base from GitHub.
 *
 * If a .git folder exists, update goes via "git fetch", otherwise the zipball
 * is downloaded and extracted to the installation folder.
 *
 * @param sha SHA hash for the commit used for the update.
 * @param callback
 */
AutoUpdate.prototype.update = function(sha, callback) {

	var that = this;

	// save current package.json and settings.js
	var oldConfig = {
		packageJson: JSON.parse(fs.readFileSync(__dirname + '../../../package.json').toString()),
		settingsJs: fs.readFileSync(__dirname + '../../../config/settings.js').toString()
	};

	// retrieve commit
	that._getCommit('https://api.github.com/repos/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/commits/' + sha, function(err, commit) {

		if (err) {
			console.error('[autoupdate] Cannot retrieve commit for revision %s: %s', sha, err);
			return callback('Cannot retrieve commit for revision "' + sha + '": ' + err);
		}

		// make sure we're not downgrading
		var v = that._readVersion();
		if (!dryRun && Date.parse(commit.commit.committer.date) < Date.parse(v.date)) {
			err = 'Not downgrading current version (' + v.date + ') to older commit (' + commit.commit.committer.date + ').';
			console.log('[autoupdate] ERROR: ' + err);
			return callback(err);
		}

		that.emit('updateStarted');

		var pindPath = path.normalize(__dirname + '../../../');

		// if git repo is available, update via git
		if (fs.existsSync(__dirname + '../../../.git')) {

			var repo = git(pindPath);

			// look for modified files via status
			repo.status(function(err, status) {
				if (err) {
					that.emit('updateFailed', { error: err });
					return callback(err);
				}

				// skip update, just run done after 5s
				if (dryRun) {
					console.log('[autoupdate] Simulating update...');
					setTimeout(function() {
						that._postExtract(err, oldConfig, commit, callback);
					}, 5000);
					return;
				}

				// fetches and rebases from remote repository
				var update = function(popStash, callback) {
					console.log('[autoupdate] Fetching update from GitHub');
					repo.remote_fetch('origin master', function(err) {
						if (err) {
							that.emit('updateFailed', { error: err });
							return callback(err);
						}

						console.log('[autoupdate] Rebasing to ' + commit.sha);
						repo.git('rebase ' + commit.sha, function(err) {
							if (err) {
								that.emit('updateFailed', { error: err });
								return callback(err);
							}

							// if stashed, re-apply changes.
							if (popStash) {
								console.log('[autoupdate] Re-applying stash');
								repo.git('stash', {}, ['apply'], function() {
									that._postExtract(err, oldConfig, commit, callback);
								});
							} else {
								that._postExtract(err, oldConfig, commit, callback);
							}
						});
					});
				};

				// check for tracked changed files
				var trackedFiles = [];
				for (var filename in status.files) {
					if (status.files.hasOwnProperty(filename) && status.files[filename].tracked) {
						if (err) {
							that.emit('updateFailed', { error: err });
							return callback(err);
						}
						trackedFiles.push(filename);
					}
				}

				// if found, stash changes
				if (trackedFiles.length > 0) {
					console.log('[autoupdate] Detected changed files: [' + trackedFiles.join(', ') + '], stashing changes first.');
					repo.git('stash', {}, ['save'], function(err) {
						if (err) {
							that.emit('updateFailed', { error: err });
							return callback(err);
						}
						update(true, callback);
					});
				} else {
					update(false, callback);
				}
			});

		// otherwise, update via zipball
		} else {

			// download zipball
			var url = 'https://github.com/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/archive/' + sha + '.zip';
			var dest = settings.pind.tmp + '/node-pind-' + sha + '.zip';
			var stream = fs.createWriteStream(dest);
			var failed = false;

			// when download completed
			stream.on('close', function() {
				if (failed) {
					return callback('Download of zipball from GitHub failed (see logs).');
				}
				console.log('[autoupdate] Done, extracting now...');
				// unzip each entry, trimming the first level of the folder structure.
				fs.createReadStream(dest)
				.pipe(unzip.Parse())
				.on('entry', function(entry) {
					if (entry.type == 'File') {
						var entryDest = path.normalize(pindPath + entry.path.substr(entry.path.indexOf('/') + 1));
						var dir = path.dirname(entryDest);
						if (!fs.existsSync(dir)) {
							mkdirp.sync(dir);
						}

						if (dryRun) {
							console.log('[autoupdate] (Not) extracting %s', entryDest);
							entry.autodrain();
						} else {
							console.log('[autoupdate] Extracting %s', entryDest);
							entry.pipe(fs.createWriteStream(entryDest));
						}
					} else {
						entry.autodrain();
					}
				}).on('close', function() {
					console.log('[autoupdate] Done, cleaning up %s', dest);
					fs.unlinkSync(dest);
						that._postExtract(err, oldConfig, commit, callback);
				});

			});
			request(url).on('response', function(response) {

				if (response.statusCode != 200) {
					failed = true;
					console.error('[autoupdate] Failed downloading zip file at %s with code %s.', url, response.statusCode);
					return;
				}
				if (response.headers['content-length']) {
					console.log('[autoupdate] Downloading %s of zipball to %s...', filesize(response.headers['content-length'], true), dest);
				} else {
					console.log('[autoupdate] Downloading zipball to %s...', dest);
				}
			}).pipe(stream);
		}

	});
};

/**
 * Executed once extraction has been completed.
 *
 *    - Compares package.json and runs npm install if necessary
 *    - Compares settings.js and patches settings-mine.js if necessary
 *    - Checks for database migrations and runs them if necessary
 *    - Kills node process
 *
 * @param err Error message if error while extracting.
 * @param oldConfig Object containing <tt>packageJson</tt> (object) and <tt>settingsJs</tt> (String) of the original configuration
 * @param newCommit Commit object from GitHub of the new version.
 * @param callback
 * @returns {*}
 * @private
 */
AutoUpdate.prototype._postExtract = function(err, oldConfig, newCommit, callback) {

	// check for errors
	var that = this;
	if (err) {
		console.log('[autoupdate] ERROR: ' + err);
		that.emit('updateFailed', { error: err });
		return callback(err);
	}
	var pindPath = path.normalize(__dirname + '../../../');

	// read updated package and settings
	var newConfig = {
		packageJson: JSON.parse(fs.readFileSync(__dirname + '../../../package.json').toString()),
		settingsJs: fs.readFileSync(__dirname + '../../../config/settings-new.js').toString()
	};

	var checkNewDependencies = function(next) {
		var newPackages = _.difference(_.keys(oldConfig.packageJson.dependencies), _.keys(newConfig.packageJson.dependencies));
		if (newPackages.length > 0) {
			console.log('[autoupdate] Found new dependencies: [' + newPackages.join(' ') + '], running `npm install`.');
			exec('npm install', { cwd: pindPath }, next);
		} else {
			console.log('[autoupdate] No new dependencies found.');
			next();
		}
	};

	var checkNewSettings = function(next) {
		if (oldConfig.settingsJs != newConfig.settingsJs) {

			/**
			 * Returns an array of path names (sepearted separated by ".") for all
			 * attributes in newTree that are not in oldTree.
			 *
			 * @param oldTree Settings object before
			 * @param newTree Settings object after
			 * @param parent Parent path, only needed when called recursively.
			 * @returns {Array}
			 */
			var diff = function(oldTree, newTree, parent) {
				parent = parent ? parent : '';
				var newProps = _.difference(_.keys(newTree), _.keys(oldTree));
				var comProps = _.intersection(_.keys(newTree), _.keys(oldTree));
				var newValues = _.map(newProps, function(key) {
					return parent ? parent + '.' + key : key;
				});
				for (var i = 0; i < comProps.length; i++) {
					var prop = oldTree[comProps[i]];
					if (_.isObject(prop)) {
						var p = parent ? parent + '.' + comProps[i] : comProps[i];
						newValues = newValues.concat(diff(oldTree[comProps[i]], newTree[comProps[i]], p));
					}
				}
				return newValues;
			};

			/**
			 * Takes the AST object and hacks it into sub-objects per property. Returns
			 * a dictionary with path separated by "." as key, and sub-tree as value.
			 *
			 * Since this is a recursive function, only the first parameter must be
			 * provided at first run.
			 *
			 * @param tree Current subtree
			 * @param path Current path
			 * @param node If property found, this is the subtree
			 * @returns {Object}
			 */
			var analyze = function(tree, path, node) {
				var nodes = {};
				if (node) {
					nodes[path] = node;
				}
				var i;
				if (tree.right) {
					_.extend(nodes, analyze(tree.right, path));
				} else if (tree.properties) {
					for (i = 0; i < tree.properties.length; i++) {
						var nextPath = (path ? path + '.' : '') + tree.properties[i].key;
						_.extend(nodes, analyze(tree.properties[i].value, nextPath, tree.properties[i]));
					}
				} else if (tree.body) {
					if (_.isArray(tree.body)) {
						for (i = 0; i < tree.body.length; i++) {
							_.extend(nodes, analyze(tree.body[i], path));
						}
					} else {
						_.extend(nodes, analyze(tree.body, path));
					}
				}
				return nodes;
			};

			var inject = function(settingsPatched, codeBlock, pos, parentPath) {
				var before = settingsPatched.substr(0, pos);
				var after = settingsPatched.substr(pos);
				var level = parentPath ? parentPath.split('.').length : 0;
				var indent = '';
				for (var i = 0; i < level; i++) {
					indent += '\t';
				}
				return before.trim() + ',\n\t' + indent + codeBlock.trim() + '\n' + indent + after.trim();
			};

			// 1. retrieve added properties
			var oldTree = {};
			var newTree = {};
			eval(oldConfig.settingsJs.replace(/module\.exports\s*=\s*\{/, 'oldTree = {'));
			eval(newConfig.settingsJs.replace(/module\.exports\s*=\s*\{/, 'newTree = {'));
			var newProps = diff(oldTree, newTree);

			// 2. retrieve code blocks of added properties
			var nodesNew = analyze(uglify.parse(newConfig.settingsJs));

			// 3. inject code blocks into old config
			var settingsPatched = oldConfig.settingsJs.trim();
			_.each(_.pick(nodesNew, newProps), function(node, path) {
				var start = node.start.comments_before.length > 0 ? node.start.comments_before[0].pos : node.start.pos;
				var codeBlock = newConfig.settingsJs.substr(start - 2, node.end.endpos - start + 2);

				// inject at the end of an element
				if (path.indexOf('.') > 0) {
					var parentPath = path.substr(0, path.lastIndexOf('.'));
					var ast = analyze(uglify.parse(settingsPatched));
					settingsPatched = inject(settingsPatched, codeBlock, ast[parentPath].end.pos, parentPath);

				// inject the end of the file.
				} else {
					settingsPatched = inject(settingsPatched, codeBlock, settingsPatched.length - 2);
				}

			});
			console.log(settingsPatched);

		} else {
			console.log('[autoupdate] Settings are identical, moving on.');
			next();
		}
	};

	var updateAndRestart = function(next) {
		// update version.json
		that.setVersion(newCommit);

		console.log('[autoupdate] Update complete.');
		that.emit('updateCompleted', newCommit);
		console.log('[autoupdate] Killing process in 2 seconds.');
		setTimeout(function() {
			console.log('[autoupdate] kthxbye');
			process.kill(process.pid, 'SIGTERM');
		}, 2000);
		next(null, version);
	};

	async.series([ checkNewDependencies, checkNewSettings ], callback);
//	async.series([ checkNewDependencies, checkNewSettings ], updateAndRestart);
};

/**
 * Checks if a new commit is available.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 	    <li>{Object} <tt>version</tt> - Version of last commit,
 * 	                 <tt>date</tt> - Date of last commit,
 * 	                 <tt>commit</tt> - commit object from GitHub.
 * 	                 or <tt>noUpdates</tt> if no updates available.
 * 	    </li></ol>
 */
AutoUpdate.prototype.newHeadAvailable = function(callback) {

	if (!version) {
		return callback('Could not find current version. version.json available?');
	}

	var userAgent = 'node-pind ' + version.version + ' auto-updater';

	// retrieve last commit
	console.log('[autoupdate] Retrieving last commit');
	request({
		url: 'https://api.github.com/repos/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/commits?per_page=1',
		headers: { 'User-Agent' : userAgent }
	}, function(err, response, body) {
		if (err) {
			return callback(err);
		}
		try {
			var commits = JSON.parse(body);
		} catch (err) {
			console.error('[autoupdate] Could not parse JSON return, got:\n%s', body);
			return callback('Could not parse JSON return for last commit at GitHub.');
		}

		if (!_.isArray(commits)) {
			console.error('[autoupdate] Expected array of commits from GitHub, got:\n%s', body);
			return callback('Could not retrieve last commit from GitHub.');
		}
		var commit = commits[0];
		var dateHead = Date.parse(commit.commit.committer.date);
		var dateCurrent = Date.parse(version.date);

		// no update if head is older or equal
		if (!dryRun && dateCurrent >= dateHead) {
			console.log('[autoupdate] No newer HEAD found at GitHub - local: %s, remote: %s.', new Date(dateCurrent), new Date(dateHead));
			return callback(null, { noUpdates: true });
		}

		// otherwise, retrieve last package.json for version
		request({
			url: 'https://raw.github.com/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/master/package.json',
			headers: { 'User-Agent': userAgent }
		}, function(err, response, body) {
			try {
				var pak = JSON.parse(body);
			} catch (err) {
				console.error('[autoupdate] [autoupdate] Could not parse JSON return, got:\n%s', body);
				return callback('Could not parse JSON return for package.json at GitHub.');
			}
			callback(null, {
				version: pak.version,
				date: new Date(dateHead),
				dateSince: relativeDate(new Date(dateHead)),
				commit: commit
			});
		});
	});
};

/**
 * Checks if a new version is available. A new version is a commit that has a valid
 * version tag.
 *
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 	    <li>{Object} <tt>version</tt> - Version of last commit,
 * 	                 <tt>date</tt> - Date of last commit,
 * 	                 <tt>tag</tt> - tag object from GitHub,
 * 	                 <tt>commit</tt> - commit object from GitHub.
 * 	    </li></ol>
 */
AutoUpdate.prototype.newTagAvailable = function(callback) {

	if (!version) {
		return callback('Could not find current version. version.json available?');
	}

	var that = this;
	var client = github.client();
	var repo = client.repo(settings.pind.repository.user + '/' + settings.pind.repository.repo);

	// retrieve all tags from node-pind repo
	console.log('[autoupdate] Retrieving tags from GitHub');
	repo.tags(function(err, tagArray) {
		if (err) {
			return callback(err);
		}

		// loop through versions and collect those later than current
		var tags = {};
		var newerTags = [];
		var cleanVer = semver.clean(version.version);
		for (var i = 0; i < tagArray.length; i++) {
			var tag = tagArray[i];
			if (semver.valid(tag.name)) {
				var cleanTagVer = semver.clean(tag.name);
				if (semver.gt(cleanTagVer, cleanVer)) {
					newerTags.push(cleanTagVer)
				}
				tags[cleanTagVer] = tag;
			}
		}
		console.log('[autoupdate] Found %d tags, getting latest.', tagArray.length);

		// sort and pop the latest
		if (newerTags.length > 0) {
			newerTags.sort(semver.rcompare);
			var lastTag = tags[newerTags[0]];

			// retrieve commit date
			console.log('[autoupdate] Getting commit data for release %s', lastTag.name);
			that._getCommit(lastTag.commit.url, function(err, commit) {
				callback(null, {
					version: lastTag.name,
					date: new Date(Date.parse(commit.commit.committer.date)),
					tag: lastTag,
					commit: commit
				});
			});
		} else {
			console.log('[autoupdate] No later tags than %s found.', cleanVer);
			callback(null, { noUpdates: true });
		}
	});
};

/**
 * Retrieves the commit object from GitHub.
 *
 * @param url API URL of the commit.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 	    <li>{Object} Commit object</li></ol>
 * @private
 */
AutoUpdate.prototype._getCommit = function(url, callback) {
	request({
		url: url,
		headers: {
			'User-Agent' : 'node-pind ' + (version ? version.version + ' ' : '') + 'auto-updater'
		}
	}, function(err, response, body) {
		if (err) {
			return callback(err);
		}
		callback(null, JSON.parse(body));
	});
};

/**
 * Reads package.json and returns defined version.
 * @returns {String} Version in package.json
 * @private
 */
AutoUpdate.prototype._getPackageVersion = function() {
	return semver.clean(JSON.parse(fs.readFileSync(__dirname + '../../../package.json')).version);
};

/**
 * Updates version.json on the file system.
 * @param version Un-serialized object
 * @private
 */
AutoUpdate.prototype._writeVersion = function(version) {
	var versionPath = path.normalize(__dirname + '../../../version.json');
	if (fs.existsSync(versionPath)) {
		console.log('[autoupdate] Updated version.json at %s', versionPath);
	} else {
		console.log('[autoupdate] Created version.json at %s', versionPath);
	}
	fs.writeFileSync(versionPath, JSON.stringify(version));
};

/**
 * Reads and returns version.json as an object.
 * @returns {Object} Parsed version object
 * @private
 */
AutoUpdate.prototype._readVersion = function() {
	var versionPath = __dirname + '../../../version.json';
	if (fs.existsSync(versionPath)) {
		return JSON.parse(fs.readFileSync(versionPath));
	}
	return null;
};

module.exports = AutoUpdate;