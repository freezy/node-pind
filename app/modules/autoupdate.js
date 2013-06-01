var fs = require('fs');
var git = require('gift');
var util = require('util');
var path = require('path');
var exec = require('child_process').exec;
var events = require('events');
var semver = require('semver');
var github = require('octonode');
var request = require('request');

var schema = require('../model/schema');
var settings = require('../../config/settings-mine');
var version = null;

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

	// retrieve version from local git repo first (hash from .git, version from package.json)
	if (fs.existsSync(__dirname + '../../../.git')) {
		var masterHead = __dirname + '../../../.git/refs/heads/master';
		version = {
			date: new Date(fs.fstatSync(fs.openSync(masterHead, 'r')).mtime),
			sha: fs.readFileSync(masterHead).toString().trim(),
			version: packageVersion
		}

		// stuff has probably been updated (during dev), so update version.json anyway.
		that._writeVersion(version);
		return callback(null, version);
	}

	// no git, so check if version.json is available.
	version = this._readVersion();
	if (version) {
		return callback(null, version);
	}

	// no git and no version.json, so let's retrieve commit data from github.
	console.log('[autoupdate] No version.json found, retrieving data from package.json and GitHub.');
	var client = github.client();
	var repo = client.repo(settings.pind.repository.user + '/' + settings.pind.repository.repo);

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

		// no match. that means, the local copy isn't a tagged version
		// but something like 0.0.3-pre. in this case, get the previous
		// tagged version, which would be 0.0.2.
		if (!matchedTag) {
			olderTags.sort(semver.rcompare);
			matchedTag = tags[olderTags[0]];
		}

		// retrieve commit
		that._getCommit(matchedTag.commit.url, function(err, commit) {
			version = {
				date: new Date(Date.parse(commit.commit.committer.date)),
				sha: commit.sha,
				version: packageVersion
			};
			that._writeVersion(version);
			callback(null, version);
		});
	});
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
 * @param commit
 * @param callback
 */
AutoUpdate.prototype.update = function(commit, callback) {

	var that = this;

	var v = this._readVersion();
	if (Date.parse(commit.commit.committer.date) < Date.parse(v.date)) {
		var err = 'Not downgrading current version (' + v.date + ') to older commit (' + commit.commit.committer.date + ').';
		console.log('[autoupdate] ERROR: ' + err);
		return callback(err);
	}

	that.on('updateCompleted', this._updateCompleted);
	that.emit('updateStarted');

	// if git repo is available, update via git
	if (fs.existsSync(__dirname + '../../../.git')) {

		var repo = git(path.normalize(__dirname + '../../../'));

		// look for modified files via status
		repo.status(function(err, status) {
			if (err) {
				that.emit('updateFailed', { error: err });
				return callback(err);
			}

			var done = function(err) {

				if (err) {
					console.log('[autoupdate] ERROR: ' + err);
					that.emit('updateFailed', { error: err });
					return callback(err);
				}
				console.log('[autoupdate] Update complete.');
				that.emit('updateCompleted', commit);
				callback();
			}

			// fetches and rebases from remote repository
			var update = function(callback) {
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
						if (trackedFiles.length > 0) {
							console.log('[autoupdate] Re-applying stash');
							repo.git('stash', {}, ['apply'], done);
						} else {
							done();
						}
					});
				});
			}

			// check for tracked changed files
			var trackedFiles = [];
			for (var filename in status.files) {
				if (status.files[filename].tracked) {
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
					update(callback);
				});
			} else {
				update(callback);
			}
		});

	// otherwise, update via zipball
	} else {

	}
};

/**
 * Checks if a new commit is available.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 	    <li>{Object} <tt>version</tt> - Version of last commit,
 * 	                 <tt>date</tt> - Date of last commit,
 * 	                 <tt>commit</tt> - commit object from GitHub.
 * 	    </li></ol>
 */
AutoUpdate.prototype.newHeadAvailable = function(callback) {

	if (!version) {
		return callback('Could not find current version. version.json available?');
	}

	var userAgent = 'node-pind ' + version.version + ' auto-updater';

	// retrieve last commit
	request({
		url: 'https://api.github.com/repos/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/commits?per_page=1',
		headers: { 'User-Agent' : userAgent }
	}, function(err, response, body) {
		if (err) {
			return callback(err);
		}
		var commit = JSON.parse(body)[0];
		var dateHead = Date.parse(commit.commit.committer.date));
		var dateCurrent = Date.parse(version.date);

		// no update if head is older
		if (dateCurrent >= dateHead) {
			return callback();
		}

		// otherwise, retrieve last package.json for version
		request({
			url: 'https://raw.github.com/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/master/package.json',
			headers: { 'User-Agent': userAgent }
		}, function(err, response, body) {
			var pak = JSON.parse(body);

			callback(null, {
				version: pak.version,
				date: new Date(dateHead),
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
	repo.tags(function(err, tagArray) {
		if (err) {
			return callback(err);
		}

		// loop through versions and collect those later than current
		var tags = {};
		var newerTags = [];
		var clearVer = semver.clean(version.version);
		for (var i = 0; i < tagArray.length; i++) {
			var tag = tagArray[i];
			if (semver.valid(tag.name)) {
				var cleanTagVer = semver.clean(tag.name);
				if (semver.gt(cleanTagVer, clearVer)) {
					newerTags.push(cleanTagVer)
				}
				tags[cleanTagVer] = tag;
			}
		}

		// sort and pop the latest
		if (newerTags.length > 0) {
			newerTags.sort(semver.rcompare);
			var lastTag = tags[newerTags[0]];

			// retrieve commit date
			that._getCommit(lastTag.commit.url, function(err, commit) {
				callback(null, {
					version: lastTag.name,
					date: new Date(Date.parse(commit.commit.committer.date)),
					tag: lastTag,
					commit: commit
				});
			});
		} else {
			callback();
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
 * Updates version.json after successful update.
 * @param commit
 * @private
 */
AutoUpdate.prototype._updateCompleted = function(commit) {

	version = {
		date: new Date(Date.parse(commit.commit.committer.date)),
		sha: commit.sha,
		version: this._getPackageVersion()
	};
	this._writeVersion(version);
}

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
		console.log('[autoupdate] Created version.json at %s', versionPath);
	} else {
		console.log('[autoupdate] Updated version.json at %s', versionPath);
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