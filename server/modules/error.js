'use strict';

var fs = require('fs');
var util = require('util');
var logger = require('winston');
var stacktrace = require('stack-trace');

exports.api = function(message, code, data) {
	var error = { error: { message: message } };
	if (code) {
		error.code = code;
	}
	if (data) {
		error.data = data;
	}
	return error;
};

exports.unauthorized = function() {
	var trace = stacktrace.get();
	console.log(util.inspect(trace[0], false, 2, true));
	logger.log('warn', 'Unauthorized access from ' + exports.unauthorized.caller.toString());
	return { error: {
		message: 'You must be logged for this RPC call.',
		code: 401
	}};
};

exports.dumpDebugData = function(module, what, data, ext) {
	//noinspection JSUnresolvedVariable
    var filename = __dirname + '/../../logs/debug-' + module + '-' + what + '-' + new Date().getTime() + '.' + (ext ? ext : 'log');
	fs.writeFileSync(filename, data);
	return fs.realpathSync(filename);
};