#!/usr/bin/env node
"use strict";

var path = require('path');
var logger = require('winston');
var childProcess = require('child_process');
var spawn = childProcess.spawn;

var dontRespawnUnder = 10000;
var minTimeBetweenRestarts = 30000;

var lastStart = +new Date();
var child = null;

var start = function() {
	logger.log('info', '\x1B[32m[pind] Starting server\x1B[0m');

	lastStart = +new Date();
	var server = path.normalize( __dirname + '/app.js' );
	child = spawn('node', [server], {
		stdio: ['pipe', process.stdout, process.stderr]
	});

	child.on('exit', function() {
		var diff = +new Date() - lastStart;
		if (diff < dontRespawnUnder) {
			logger.log('warn', '[pind] Crashed too fast (not restarting), check message above.');
		} else if (diff < minTimeBetweenRestarts) {
			logger.log('info', '[pind] Already restarted ' + diff + 'ms ago, waiting a minute.');
			setTimeout(start, 60000);
		} else {
			logger.log('info', '[pind] Restarting application.');
			start();
		}
	});
};

start();