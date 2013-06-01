var fs = require('fs');
var util = require('util');
var path = require('path');
var events = require('events');
var semver = require('semver');
var github = require('octonode');
var request = require('request');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');

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

AutoUpdate.prototype.updateAvailable = function(callback) {
	var currentVersion = semver.clean(JSON.parse(fs.readFileSync(__dirname + '../../../package.json')).version);

	var client = github.client();
	var repo = client.repo(settings.pind.repository.user + '/' + settings.pind.repository.repo);

	console.log('Current version is %s', currentVersion);
	console.log('Retrieving tags...');

	repo.tags(function(err, tags) {
		if (err) {
			return callback(err);
		}
		var versions = {};
		var newerVersions = [];
		for (var i = 0; i < tags.length; i++) {
			var tag = tags[i];
			if (semver.valid(tag.name)) {
				var tagVersion = semver.clean(tag.name);
				if (semver.gt(tagVersion, currentVersion)) {
					newerVersions.push(tagVersion)
				}
				versions[tagVersion] = tag;
			}
		}
		if (newerVersions.length > 0) {
			newerVersions.sort(semver.rcompare);
			var lastTag = versions[newerVersions[0]];
			request({
				url: lastTag.commit.url,
				headers: {
					'User-Agent' : 'node-pind ' + currentVersion + ' auto-updater'
				}
			}, function(err, response, body) {
				if (err) {
					return callback(err);
				}
				var commit = JSON.parse(body);
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

module.exports = AutoUpdate;
