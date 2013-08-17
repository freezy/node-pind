'use strict';

var _ = require('underscore');
var fs = require('fs');
var npm = require('npm');
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
var logger = require('winston');
var request = require('request');
var filesize = require('filesize');
var readdirp = require('readdirp');
var Sequelize = require('sequelize');
var relativeDate = require('relative-date');

var an = require('./announce');

var schema = require('../database/schema');
var settings = require('../../config/settings-mine');
var version = null;
var localRepo = null;

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
 * When writing migration scripts, name them YYYYMMDDHHmmss-sha1-migration-name.js.
 * Get the timestamp by running
 * 	php -r "date_default_timezone_set('UTC');echo date('YmdHis', trim(`git diff-tree -s --pretty=%at sha1`));"
 *
 * @returns {AutoUpdate}
 * @constructor
 */
function AutoUpdate() {
	events.EventEmitter.call(this);
	this.initAnnounce();
	if (fs.existsSync(__dirname + '../../../.git')) {
		localRepo = git(path.normalize(__dirname + '../../../'));
	}
}
util.inherits(AutoUpdate, events.EventEmitter);

/**
 * Sets up event listener for realtime updates via Socket.IO.
 */
AutoUpdate.prototype.initAnnounce = function() {
	an.forward(this, 'upgradeStarted');
	an.forward(this, 'upgradeCompleted');
	an.forward(this, 'upgradeFailed');
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
	if (localRepo) {
		localRepo.commits('master', 1, function(err, commits) {
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
	logger.log('info', '[autoupdate] No version.json found, retrieving data from package.json and GitHub.');
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

		if (matchedTag) {
			// retrieve commit
			that._getCommit(matchedTag.commit.url, function(err, commit) {
				that.setVersion(commit, packageVersion);
				callback(null, version);
			});

		// no match. that means the local copy isn't a tagged version
		// but something like 0.0.3-pre. in this case, find the last
		// modified file and retrieve the first commit after.
		} else {

			logger.log('info', '[autoupdate] Local copy is not a tagged version (%s), trying to match a commit on GitHub.', packageVersion);
			var lastModifiedTime = 0;
			var lastModifiedFile, time;
			readdirp({
				root: path.normalize(__dirname + '../../../'),
				directoryFilter: [ '!.git', '!node_modules', '!.idea' ],
				fileFilter: [ '!pinemhi.ini', '!*.log' ]
			}).on('data', function(entry) {
				time = +new Date(entry.stat.mtime);
				if (time > lastModifiedTime) {
					lastModifiedTime = time;
					lastModifiedFile = entry.path;
				}
			}).on('end', function(err) {
				if (err) {
					return callback(err);
				}
				var lastModifiedDate = new Date(lastModifiedTime);
				logger.log('info', '[autoupdate] Last modified file is "%s", changed: %s.', lastModifiedFile, lastModifiedDate, {});
				logger.log('info', '[autoupdate] Finding nearest commit..');

				repo.commits(function(err, commits) {
					var commit, commitTime, lastCommit;
					var found = false;
					for (var i = 0; i < commits.length; i++) {
						commit = commits[i];
						commitTime = +new Date(commit.commit.committer.date);
						if (commitTime < lastModifiedTime) {
							if (!lastCommit) {
								lastCommit = commit;
							}
							found = true;
							break;
						}
						lastCommit = commit;
					}
					if (found) {
						logger.log('info', '[autoupdate] Found commit "%s" from %s.', lastCommit.sha.substr(0, 7), new Date(commitTime), {});
						that.setVersion(lastCommit, packageVersion);
						callback(null, version);
					} else {
						logger.log('error', '[autoupdate] More than 30 new commits, please update and try again.');
						logger.log('info', 'Goodbye, killing myself.');
						process.kill(process.pid, 'SIGTERM');
					}
				});
			});
		}
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
	var startedAt = new Date();
	that.emit('upgradeStarted');
	logger.log('info', '[autoupdate] Starting update.');

	// separate log
	logger.add(logger.transports.Memory);

	// save current package.json and settings.js
	var oldConfig = {
		startedAt: startedAt,
		packageJson: JSON.parse(fs.readFileSync(__dirname + '../../../package.json').toString()),
		settingsJs: fs.readFileSync(__dirname + '../../../config/settings.js').toString().replace(/\x0D\x0A/gi, '\n')
	};

	// retrieve commit
	that._getCommit('https://api.github.com/repos/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/commits/' + sha, function(err, commit) {

		if (err) {
			logger.log('error', '[autoupdate] Cannot retrieve commit for revision %s: %s', sha, err);
			return that._logResult('Cannot retrieve commit for revision "' + sha + '": ' + err, startedAt, sha, null, callback);
		}

		// make sure we're not downgrading
		var v = that._readVersion();
		if (!dryRun && Date.parse(commit.commit.committer.date) < Date.parse(v.date)) {
			err = 'Not downgrading current version (' + v.date + ') to older commit (' + commit.commit.committer.date + ').';
			logger.log('info', '[autoupdate] ERROR: ' + err);
			return that._logResult(err, startedAt, sha, null, callback);
		}

		that.emit('updateStarted');

		var pindPath = path.normalize(__dirname + '../../../');

		// if git repo is available, update via git
		if (localRepo) {

			// look for modified files via status
			localRepo.status(function(err, status) {
				if (err) {
					return that._logResult(err, startedAt, sha, null, callback);
				}

				// skip update, just run done after 5s
				if (dryRun) {
					logger.log('info', '[autoupdate] Simulating update...');
					setTimeout(function() {
						that._postExtract(err, oldConfig, commit, callback);
					}, 3000);
					return;
				}

				// fetches and rebases from remote repository
				var update = function(popStash, callback) {
					logger.log('info', '[autoupdate] Fetching update from GitHub');
					localRepo.remote_fetch('origin master', function(err) {
						if (err) {
							return that._logResult(err, startedAt, sha, null, callback);
						}

						logger.log('info', '[autoupdate] Rebasing to ' + commit.sha);
						localRepo.git('rebase ' + commit.sha, function(err) {
							if (err) {
								return that._logResult(err, startedAt, sha, null, callback);
							}

							// if stashed, re-apply changes.
							if (popStash) {
								logger.log('info', '[autoupdate] Re-applying stash');
								localRepo.git('stash', {}, ['apply'], function() {
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
							return that._logResult(err, startedAt, sha, null, callback);
						}
						trackedFiles.push(filename);
					}
				}

				// if found, stash changes
				if (trackedFiles.length > 0) {
					logger.log('info', '[autoupdate] Detected changed files: [' + trackedFiles.join(', ') + '], stashing changes first.');
					localRepo.git('stash', {}, ['save'], function(err) {
						if (err) {
							return that._logResult(err, startedAt, sha, null, callback);
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
					return that._logResult('Download of zipball from GitHub failed (see logs).', startedAt, sha, null, callback);
				}
				logger.log('info', '[autoupdate] Done, extracting now...');
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
							logger.log('info', '[autoupdate] (Not) extracting %s', entryDest);
							entry.autodrain();
						} else {
							logger.log('info', '[autoupdate] Extracting %s', entryDest);
							entry.pipe(fs.createWriteStream(entryDest));
						}
					} else {
						entry.autodrain();
					}
				}).on('close', function() {
					logger.log('info', '[autoupdate] Done, cleaning up %s', dest);
					fs.unlinkSync(dest);
					that._postExtract(err, oldConfig, commit, callback);
				});

			});
			request(url).on('response', function(response) {

				if (response.statusCode != 200) {
					failed = true;
					logger.log('error', '[autoupdate] Failed downloading zip file at %s with code %s.', url, response.statusCode);
					return;
				}
				if (response.headers['content-length']) {
					logger.log('info', '[autoupdate] Downloading %s of zipball to %s...', filesize(response.headers['content-length'], true), dest);
				} else {
					logger.log('info', '[autoupdate] Downloading zipball to %s...', dest);
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

	var result = {
		updatedFrom: version,
		updatedTo: null,
		commits: [],
		dependencies: {
			added: [],
			updated: [],
			removed: []
		},
		settings: [],
		migrations: [],
		tags: [],
		errors: []
	};

	// check for errors
	var that = this;
	if (err) {
		logger.log('error', '[autoupdate] ERROR: ' + err);
		return that._logResult(err, oldConfig.startedAt, newCommit.sha, null, callback);
	}

	// read updated package and settings
	var newConfig = {
		packageJson: JSON.parse(fs.readFileSync(__dirname + '../../../package.json').toString()),
		settingsJs: fs.readFileSync(__dirname + '../../../config/settings.js').toString().replace(/\x0D\x0A/gi, '\n')
	};

	// use another file to compare for dry runs if available.
	if (dryRun) {
		if (fs.existsSync(__dirname + '../../../package-new.json')) {
			newConfig.packageJson = JSON.parse(fs.readFileSync(__dirname + '../../../package-new.json').toString());
		}
		if (fs.existsSync(__dirname + '../../../config/settings-new.js')) {
			newConfig.settingsJs = fs.readFileSync(__dirname + '../../../config/settings-new.js').toString().replace(/\x0D\x0A/gi, '\n');
		}
	}

	var checkNewDependencies = function(next) {
		var newPackages = _.difference(_.keys(newConfig.packageJson.dependencies), _.keys(oldConfig.packageJson.dependencies));
		var newPackageVersions = _.difference(_.values(newConfig.packageJson.dependencies), _.values(oldConfig.packageJson.dependencies));
		if (newPackages.length > 0 || newPackageVersions.length > 0) {
			// check what has changed for log
			if (newPackages.length > 0) {
				_.each(newPackages, function(p) {
					if (newConfig.packageJson.dependencies[p]) {
						result.dependencies.added.push({
							name: p,
							version: newConfig.packageJson.dependencies[p]
						});
					} else {
						result.dependencies.removed.push({
							name: p,
							version: oldConfig.packageJson.dependencies[p]
						});
					}
				});
			}
			if (newPackageVersions.length > 0) {
				_.each(oldConfig.packageJson.dependencies, function(ver, dep) {
					if (oldConfig.packageJson.dependencies[dep] != newConfig.packageJson.dependencies[dep]) {
						if (newConfig.packageJson.dependencies[dep]) {
							result.dependencies.updated.push({
								name: dep,
								from: oldConfig.packageJson.dependencies[dep],
								version: newConfig.packageJson.dependencies[dep]
							});
						} else {
							result.dependencies.removed.push({
								name: dep,
								version: oldConfig.packageJson.dependencies[dep]
							});
						}
					}
				})
			}
			logger.log('info', '[autoupdate] Found new dependencies: [' + newPackages.join(' ') + '], running `npm install`.');
			npm.load({ prefix: path.normalize(__dirname + '../../../') }, function(err) {
				if (err) {
					logger.log('error', '[autoupdate] Error loading npm: ' + err);
					result.errors.push({
						when: 'dependencies',
						message: err
					});
					return next();
				}
				npm.on('log', function(message) {
					logger.log('info', '[autoupdate] [npm] ' + message);
				});
				var getUrls = function(deps) {
					var p;
					_.each(deps, function(dep) {
						if (fs.existsSync(__dirname + '../../../node_modules/' + dep.name + '/package.json')) {
							try {
								p = JSON.parse(fs.readFileSync(__dirname + '../../../node_modules/' + dep.name + '/package.json').toString());
								if (p.homepage) {
									dep.url = p.homepage;
								} else if (p.repository && p.repository.url) {
									dep.url = p.repository.url.replace(/^git:/i, 'https:');
								}
							} catch (err) {}
						}
					});
				};
				if (dryRun) {
					logger.log('info', '[autoupdate] Skipping `npm install`.');
					getUrls(result.dependencies.added);
					getUrls(result.dependencies.updated);
					getUrls(result.dependencies.removed);
					return next();
				}
				npm.commands.install([], function(err) {
					if (err) {
						logger.log('error', '[autoupdate] Error updating dependencies: ' + err);
						result.errors.push({
							when: 'dependencies',
							message: err.toString()
						});
						return next();
					}
					logger.log('info', '[autoupdate] NPM update successful.');
					getUrls(result.dependencies.added);
					getUrls(result.dependencies.updated);
					getUrls(result.dependencies.removed);
					next();
				});
			});
		} else {
			logger.log('info', '[autoupdate] No new dependencies found.');
			next();
		}
	};

	var checkNewSettings = function(next) {

		if (oldConfig.settingsJs != newConfig.settingsJs) {
			logger.log('info', '[autoupdate] Checking for new settings.');

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

			var patch = function(settingsPatched, codeBlock, pos, parentPath) {
				//console.log('PATCHING:\n------\n%s\n------ at pos %d below %s', codeBlock, pos, parentPath);
				var before = settingsPatched.substr(0, pos);
				var after = settingsPatched.substr(pos);
				var level = parentPath ? parentPath.split('.').length : 0;
				var indent = '';
				for (var i = 0; i < level; i++) {
					indent += '\t';
				}
				return before.trim() + ',\n\t' + indent + codeBlock.trim().replace(/,$/, '') + '\n' + indent + after.trim();
			};

			// 1. retrieve added properties
			var oldTree = {};
			var newTree = {};
			eval(oldConfig.settingsJs.replace(/module\.exports\s*=\s*\{/, 'oldTree = {'));
			eval(newConfig.settingsJs.replace(/module\.exports\s*=\s*\{/, 'newTree = {'));
			var newProps = diff(oldTree, newTree);
			if (newProps.length == 0) {
				logger.log('info', '[autoupdate] No new settings found.');
				return next();
			}
			logger.log('info', '[autoupdate] Found new settings: [' + newProps.join(', ') + ']');

			// 2. retrieve code blocks of added properties
			var nodesNew = analyze(uglify.parse(newConfig.settingsJs));

			// 3. inject code blocks into settings-mine.js
			var settingsMinePath = __dirname + '../../../config/settings-mine.js';
			var settingsPatched = fs.readFileSync(settingsMinePath).toString().trim().replace(/\x0D\x0A/gi, '\n');
			var settingsNew = _.pick(nodesNew, newProps);
			var settingsNewKeys = _.keys(settingsNew);
			for (var i = 0; i < settingsNewKeys.length; i++) {
				var path = settingsNewKeys[i]; // path in settings to be added
				var node = settingsNew[path];  // ast node corresponding to the setting to be added
				try {
					// analyze current settings-mine, so we know where to inject
					var ast = analyze(uglify.parse(settingsPatched));
				} catch(err) {
					logger.log('error', '[autoupdate] Error parsing patched file: ' + err);
					result.errors.push({
						when: 'settings',
						message: err.message,
						obj: err
					});
					fs.writeFileSync(__dirname + '../../../config/settings-err.js', settingsPatched);
					logger.log('info', '[autoupdate] File dumped to config/settings-err.js.');
					return next();
				}

				// check if not already available
				if (!ast[path]) {
					logger.log('info', '[autoupdate] Patching settings-mine.js with setting "' + path + '"');

					var comment = node.start.comments_before.length > 0;
					var start = comment ? node.start.comments_before[0].pos : node.start.pos;
					var len = comment ? node.end.endpos - start : node.end.endpos - start;
					var codeBlock = newConfig.settingsJs.substr(start, len).trim().replace(/\x0D\x0A/gi, '\n');
					//logger.log('info', '\n===============\n%s\n===============\n', util.inspect(node, false, 10, true));

					// inject at the end of an element
					if (path.indexOf('.') > 0) {
						var parentPath = path.substr(0, path.lastIndexOf('.'));
						settingsPatched = patch(settingsPatched, codeBlock, ast[parentPath].end.pos, parentPath);

					// inject the end of the file.
					} else {
						settingsPatched = patch(settingsPatched, codeBlock, settingsPatched.length - 2);
					}

					// add message to result
					var descr = node.start.comments_before[0] ? node.start.comments_before[0].value.trim() : null;
					var important = false;
					if (descr) {

						if (descr.match(/\*\s*@important/i)) {
							descr = descr.replace(/\s*\*\s*@important\s*/g, '');
							important = true;
						}
						descr = descr.replace(/\s*\*\s+\*\s*/g, '\n');
						descr = descr.replace(/\s*\*\s*/g, ' ').trim();

					}
					result.settings.push({
						parent: parentPath ? parentPath : null,
						name: node.start.value,
						value: node.end.value,
						valuetype: node.end.type,
						description: descr,
						important: important
					});

				} else {
					logger.log('info', '[autoupdate] settings-mine.js already contains "' + path + '", skipping.');
				}
			}
			if (!dryRun) {
				fs.writeFileSync(settingsMinePath, settingsPatched);
				logger.log('info', '[autoupdate] Updated settings-mine.js.');
			} else {
				logger.log('info', '[autoupdate] Updated settings-patched.js.');
				fs.writeFileSync(__dirname + '../../../config/settings-patched.js', settingsPatched);
			}
			next();

		} else {
			logger.log('info', '[autoupdate] Settings are identical, moving on.');
			next();
		}
	};

	var checkNewMigrations = function(next) {
		logger.log('info', '[autoupdate] Checking for new migrations.');

		// read scripts
		var scripts = {};
		_.each(fs.readdirSync(__dirname + '../../../migrations/'), function(filename) {
			if (path.extname(filename) == '.js') {
				var parts = filename.split('-');
				if (parts.length >= 3) {
					scripts[parts[1]] = {
						filename: filename,
						path: path.normalize(__dirname + '../../../migrations/' + filename),
						num: parts[0],
						sha: parts[1],
						description: path.basename(parts.slice(2).join(' '), '.js')
					}
				} else {
					logger.log('warn', '[autoupdate] Unexpected file name: %s', filename);
				}
			} else {
				logger.log('warn', '[autoupdate] Weird extension: %s', filename.substr(filename.lastIndexOf('.')));
			}
		});

		// read commits
		if (!version || !version.sha) {
			result.errors.push({
				when: 'settings',
				message: 'version object not set.'
			});
			return next();
		}
		var migrator = schema.sequelize.getMigrator();
		var oldCommit = dryRun ? 'f079931cb3ae97f7e9d5f9ac621d836d7fcfa0b6' : version.sha;
		that._getCommits(oldCommit, newCommit.sha, function(err, commits) {
			if (err) {
				result.errors.push({
					when: 'migrations',
					message: err
				});
				return next();
			}
			_.each(commits, function(commit) {

				result.commits.push(commit);
				var sha = commit.sha.substr(0, 7);
				if (scripts[sha] && !dryRun) {
					result.migrations.push(scripts[sha]);
					logger.log('info', '[autoupdate] Running script "%s"', scripts[sha].description);
					migrator.exec(scripts[sha].path, {
						before: function(migration) {
							logger.log('info', '[autoupdate] Starting migration for "%s"', migration.filename);
						}
					}).success(function() {
						logger.log('info', '[autoupdate] Migration executed successfully.');
					}).error(function(err) {
						logger.log('error', '[autoupdate] Migration went wrong, see logfile: ', err, {});
						result.errors.push({
							when: 'migrations',
							message: err,
							script: scripts[sha]
						});
					});
				}
			});
			next();
		});
	};

	var finishAndRestart = function(next) {
		// update version.json
		that.setVersion(newCommit);

		// compute and save update result.
		result.updatedTo = version;
		that._logResult(null, oldConfig.startedAt, newCommit.sha, result, function(err, result) {

			// reboot
			logger.log('info', '[autoupdate] Update complete: %s', util.inspect(result, false, 10, false)); // last is color
			logger.log('warn', '[autoupdate] Killing process in 2 seconds.');
			setTimeout(function() {
				logger.log('err', '[autoupdate] kthxbye');
				process.kill(process.pid, 'SIGTERM');
			}, 2000);
			next(null, result);

		});
	};

	async.series([ checkNewDependencies, checkNewSettings, checkNewMigrations ], function(err) {
		if (err) {
			return that._logResult(err, oldConfig.startedAt, newCommit.sha, null, callback);
		}
		finishAndRestart(callback);
	});
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
	logger.log('info', '[autoupdate] Retrieving last commit');
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
			logger.log('error', '[autoupdate] Could not parse JSON return, got:\n%s', body);
			return callback('Could not parse JSON return for last commit at GitHub.');
		}

		if (!_.isArray(commits)) {
			logger.log('error', '[autoupdate] Expected array of commits from GitHub, got:\n%s', body);
			return callback('Could not retrieve last commit from GitHub.');
		}
		var commit = commits[0];
		var dateHead = Date.parse(commit.commit.committer.date);
		var dateCurrent = Date.parse(version.date);

		// no update if head is older or equal
		if (!dryRun && dateCurrent >= dateHead) {
			logger.log('info', '[autoupdate] No newer HEAD found at GitHub - local: %s, remote: %s.', new Date(dateCurrent), new Date(dateHead), {});
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
				logger.log('error', '[autoupdate] [autoupdate] Could not parse JSON return, got:\n%s', body);
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
	logger.log('info', '[autoupdate] Retrieving tags from GitHub');
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
		logger.log('info', '[autoupdate] Found %d tags, getting latest.', tagArray.length);

		// sort and pop the latest
		if (newerTags.length > 0) {
			newerTags.sort(semver.rcompare);
			var lastTag = tags[newerTags[0]];

			// retrieve commit date
			logger.log('info', '[autoupdate] Getting commit data for release %s', lastTag.name);
			that._getCommit(lastTag.commit.url, function(err, commit) {
				callback(null, {
					version: lastTag.name,
					date: new Date(Date.parse(commit.commit.committer.date)),
					tag: lastTag,
					commit: commit
				});
			});
		} else {
			logger.log('info', '[autoupdate] No later tags than %s found.', cleanVer);
			callback(null, { noUpdates: true });
		}
	});
};

/**
 * Retrieves commits between two given SHAs (those inclusively). If local Git repository is available, they're
 * retrieved from there, otherwise GitHub is queried.
 *
 * @param fromSha Starting hash
 * @param toSha Ending hash
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 	    <li>{Array} Commits. Objects containing <tt>sha</tt> {String} and <tt>date</tt> {Date} as properties.</li></ol>
 * @param result For recursive calling, this is the current result when paginating.
 * @private
 */
AutoUpdate.prototype._getCommits = function(fromSha, toSha, callback, result) {
	if (localRepo) {
		logger.log('info', '[autoupdate] Retrieving commits %s..%s from local Git repository.', fromSha.substr(0,7), toSha.substr(0,7));
		if (!result) {
			result = {
				page: 0,
				started: false,
				ended: false,
				commits: []
			};
		}
		localRepo.commits('master', 100, result.page * 10, function(err, commits) {
			if (err) {
				return callback(err);
			}
			_.sortBy(commits, function(commit) {
				return -commit.committed_date.getTime();
			});
			for (var i = 0; i < commits.length; i++) {
				var sha = commits[i].id;
				if (sha == toSha) {
					result.started = true;
				} else if (!result.started) {
				}
				if (result.started) {
					result.commits.push({
						sha: sha,
						date: commits[i].committed_date,
						message: commits[i].message
					});
				}
				if (sha == fromSha) {
					result.ended = true;
					break;
				}
			}
			if (!result.ended) {
				if (commits.length > 0) {
					result.page++;
					AutoUpdate.prototype._getCommits(fromSha, toSha, callback, result);
				} else {
					logger.log('error', '[autoupdate] Ran through all commits but could not find commit with SHA %s.', toSha);
					callback('Ran through all commits but could not find commit with SHA ' + toSha + '.');
				}
			} else {
				if (result.commits.length == 0) {
					logger.log('error', '[autoupdate] Ending commit %s seems to be before starting commit %s.', fromSha, toSha);
					callback('Ending commit ' + fromSha + ' seems to be before starting commit ' + toSha + '.');
				} else {
					logger.log('info', '[autoupdate] Done, returning list of %d commits', result.commits.length);
					callback(null, result.commits);
				}
			}
		});

	} else {

		logger.log('info', '[autoupdate] Retrieving commits %s..%s from GitHub.', fromSha.substr(0,7), toSha.substr(0,7));
		var fromUrl = 'https://api.github.com/repos/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/commits/' + fromSha;
		var toUrl = 'https://api.github.com/repos/' + settings.pind.repository.user + '/' + settings.pind.repository.repo + '/commits/' + toSha;

		AutoUpdate.prototype._getCommit(fromUrl, function(err, commitFrom) {
			if (err) {
				return callback(err);
			}
			if (!commitFrom.sha) {
				logger.log('error', '[autoupdate] Could not find starting commit %s on GitHub.', toSha);
				return callback('Could not find starting commit ' + toSha + ' on GitHub.');
			}

			AutoUpdate.prototype._getCommit(toUrl, function(err, commitTo) {
				if (err) {
					return callback(err);
				}
				if (!commitTo.sha) {
					logger.log('error', '[autoupdate] Could not find ending commit %s on GitHub.', toSha);
					return callback('Could not find ending commit ' + toSha + ' on GitHub.');
				}

				var result = [];
				var fetchCommits = function(url) {
					if (!url) {
						url = 'https://api.github.com/repos/'
						+ settings.pind.repository.user + '/'
						+ settings.pind.repository.repo + '/commits'
						+ '?since=' + commitTo.committer.date
						+ '&until=' + commitFrom.committer.date
						+ '&per_page=100';
					}
					logger.log('info', '[autoupdate] Fetching %s', url);
					request({
						url: url,
						headers: {
							'User-Agent' : AutoUpdate.prototype._getUserAgent()
						}
					}, function(err, response, body) {
						if (err) {
							return callback(err);
						}
						var commits = JSON.parse(body);
						if (!_.isArray(commits)) {
							logger.log('error', '[autoupdate] Expected an array in return but got this: %s', body);
							return callback('Unexpected return from GitHub, check logs.');
						}
						if (commits.length == 0) {
							logger.log('error', '[autoupdate] Got an empty list, that should not have happened. Either provided wrong SHAs (unlikely) or missed the end SHA.');
							return callback('Unexpected return from GitHub, check logs.');
						}

						for (var i = 0; i < commits.length; i++) {
							result.push({
								sha: commits[i].sha,
								date: new Date(commits[i].commit.committer.date),
								message: commits[i].commit.message
							});
						}
						// next page is in header, see http://developer.github.com/v3/#pagination
						if (response.headers.link) {
							var links = response.headers.link.split(',');
							var foundNext = false;
							for (i = 0; i < links.length; i++) {
								var link = links[i].split(';');
								if (link[1].trim().match(/rel\s*=\s*["']next["']/i)) {
									fetchCommits(link[0].trim().replace(/^<|>$/g, ''));
									foundNext = true;
									break;
								}
							}
							if (!foundNext) {
								callback(null, result);
							}
						} else {
							callback(null, result);
						}
					});
				};
				logger.log('info', '[autoupdate] Found both commits on Github, now fetching commits in between.');
				fetchCommits();
			});
		});
	}
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
			'User-Agent' : AutoUpdate.prototype._getUserAgent()
		}
	}, function(err, response, body) {
		if (err) {
			return callback(err);
		}
		callback(null, JSON.parse(body));
	});
};

AutoUpdate.prototype._getUserAgent = function() {
	return 'node-pind ' + (version ? version.version + ' ' : '') + 'auto-updater';
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
		logger.log('info', '[autoupdate] Updated version.json at %s', versionPath);
	} else {
		logger.log('info', '[autoupdate] Created version.json at %s', versionPath);
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

/**
 * Adds an upgrade entry to the database and calls the provided callback.
 * @param err If set, an error status will be created.
 * @param startedAt Date the update was started
 * @param toSha Sha of the version to update
 * @param result Update result
 * @param callback Callback, called with err and result.
 * @private
 */
AutoUpdate.prototype._logResult = function(err, startedAt, toSha, result, callback) {
	var that = this;
	if (err) {
		this.emit('updateFailed', { error: err });
		schema.Upgrade.create({
			fromSha: version.sha,
			toSha: toSha,
			status: 'error',
			result: JSON.stringify({ error: { message: err }}),
			log: JSON.stringify({
				out: logger['default'].transports['memory'].writeOutput,
				err: logger['default'].transports['memory'].errorOutput
			}),
			startedAt: startedAt,
			completedAt: new Date()
		}).done(function(err) {
				logger['default'].transports['memory'].clearLogs();
				logger.remove(logger.transports.Memory);
			if (err) {
				logger.log('error', '[autoupdate] Error updating database: ' + err);
			}
			that.emit('upgradeFailed');
			callback(err);
		});
	} else {
		this.emit('updateCompleted', result);
		schema.Upgrade.create({
			fromSha: version.sha,
			toSha: toSha,
			status: 'success',
			result: JSON.stringify(result),
			log: JSON.stringify({
				out: logger['default'].transports['memory'].writeOutput,
				err: logger['default'].transports['memory'].errorOutput
			}),
			repo: settings.pind.repository.user + '/' + settings.pind.repository.repo,
			startedAt: startedAt,
			completedAt: new Date()
		}).done(function(err) {
			logger['default'].transports['memory'].clearLogs();
			logger.remove(logger.transports.Memory);
			if (err) {
				logger.log('error', '[autoupdate] Error updating database: ' + err);
			}
			that.emit('upgradeCompleted');
			callback(null, result);
		});
	}
};

module.exports = new AutoUpdate();