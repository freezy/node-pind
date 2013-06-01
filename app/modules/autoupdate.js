var fs = require('fs');
var util = require('util');
var path = require('path');
var events = require('events');
var semver = require('semver');
var github = require('octonode');
var request = require('request');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');
var version = null;

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
	var versionPath = path.normalize(__dirname + '../../../version.json');

	var write = function(version) {
		fs.writeFileSync(versionPath, JSON.stringify(version));
		console.log('[autoupdate] Created version.json at %s', versionPath);
	}

	// check if version.json is available.
	if (fs.existsSync(__dirname + '../../../version.json')) {
		version = JSON.parse(fs.readFileSync(versionPath));
		return callback(null, version);

	} else {

		// retrieve version string from package.json
		var packageVersion = semver.clean(JSON.parse(fs.readFileSync(__dirname + '../../../package.json')).version);

		// check if we're in a git repo already
		if (fs.existsSync(__dirname + '../../../.git')) {

			console.log('[autoupdate] No version.json found, retrieving data from git repository.');
			var masterHead = __dirname + '../../../.git/refs/heads/master';
			version = {
				date: new Date(fs.fstatSync(fs.openSync(masterHead, 'r')).mtime),
				sha: fs.readFileSync(masterHead).toString().trim(),
				version: packageVersion
			}
			write(version);
			callback(null, version);

		// if not, read version from package.json and retrieve hash and date from GitHub.
		} else {

			console.log('[autoupdate] No version.json found, retrieving data from package.json and GitHub.');
			var client = github.client();
			var repo = client.repo(settings.pind.repository.user + '/' + settings.pind.repository.repo);

			// retrieve all tags from node-pind repo
			repo.tags(function(err, tagArray) {
				if (err) {
					return callback(err);
				}

				// loop through versions and try to match the one from package.json
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
							olderTags.push(cleanTagVer)
						}
						tags[cleanTagVer] = tag;
					}
				}

				// no match. that means, the local copy isn't a tagged version,
				// but something like 0.0.3-pre. in this case, get the previous
				// tagged version, in this case 0.0.2.
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
					write(version);
					callback(null, version);
				});
			});
		}
	}
};


/**
 * Checks if a new commit is available.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} <tt>version</tt> - Version of last commit,
 * 	                 <tt>date</tt> - Date of last commit,
 * 	                 <tt>commit</tt> - commit object from GitHub.
 * 	    </li></ol>
 */
AutoUpdate.prototype.newCommitAvailable = function(callback) {

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

		// retrieve last package.json for version
		request({
			url: 'https://raw.github.com/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/master/package.json',
			headers: { 'User-Agent': userAgent }
		}, function(err, response, body) {
			var pak = JSON.parse(body);

			callback(null, {
				version: pak.version,
				date: new Date(Date.parse(commit.commit.committer.date)),
				commit: commit
			});
		});
	});
}

/**
 * Checks if a new version is available. A new version is a commit that has a valid
 * version tag.
 *
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} <tt>version</tt> - Version of last commit,
 * 	                 <tt>date</tt> - Date of last commit,
 * 	                 <tt>tag</tt> - tag object from GitHub,
 * 	                 <tt>commit</tt> - commit object from GitHub.
 * 	    </li></ol>
 */
AutoUpdate.prototype.newVersionAvailable = function(callback) {

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
 * 		<li>{Object} Commit object</li></ol>
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

module.exports = AutoUpdate;
