#!/usr/bin/env node
"use strict";

var util = require('util');
var childProcess = require('child_process');
var spawn = childProcess.spawn;

var minTimeBetweenRestarts = 30000;

var lastStart = +new Date();
var child = null;

var start = function() {
	util.log('\x1B[32m[pind] Starting server\x1B[0m');

	lastStart = +new Date();
	child = spawn('node', ['server.js'], {
		stdio: ['pipe', process.stdout, process.stderr]
	});

	child.on('exit', function() {
		var diff = +new Date() - lastStart;
		if (diff < minTimeBetweenRestarts) {
			util.log('[pind] Already restarted ' + diff + 'ms ago, waiting a minute.');
			setTimeout(start, 60000);
		} else {
			util.log('[pind] Restarting application.');
			start();
		}
	});
};

start();