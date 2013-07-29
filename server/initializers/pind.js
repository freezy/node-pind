var fs = require('fs');
var path = require('path');
var logger = require('winston');

var hs = require('../modules/hiscore');
var au = require('../modules/autoupdate');
var transfer = require('../modules/transfer');

module.exports = function() {

	// make sure settings-mine.js is available
	if (!fs.existsSync(__dirname + '/../../config/settings-mine.js')) {
		throw new Error('Settings not found. Please copy "config/settings.js" to "config/settings-mine.js" and update settings-mine.js according to your setup.');
	}

	// initialize logger
	var logDir = path.normalize(__dirname + '/../../logs');
	if (!fs.existsSync(logDir)) {
		console.log('[init] Log folder does not exist, creating ' + logDir);
		fs.mkdirSync(logDir);
	}
	logger.remove(logger.transports.Console);
	logger.add(logger.transports.File, {
		level: 'info',                   // Level of messages that this transport should log.
		silent: false,                   // Boolean flag indicating whether to suppress output.
		colorize: false,                 // Boolean flag indicating if we should colorize output.
		timestamp: true,                 // Boolean flag indicating if we should prepend output with timestamps (default true). If function is specified, its return value will be used instead of timestamps.
		filename: logDir + '/pind.log',  // The filename of the logfile to write output to.
		maxsize: 1000000,                // Max size in bytes of the logfile, if the size is exceeded then a new file is created.
		maxFiles: 10,                    // Limit the number of files created when the size of the logfile is exceeded.
		stream: null,                    // The WriteableStream to write output to.
		json: false                      // If true, messages will be logged as JSON (default true).
	});
	logger.add(logger.transports.Console, {
		level: 'info',   // Level of messages that this transport should log (default 'info').
		silent: false,   // Boolean flag indicating whether to suppress output (default false).
		colorize: true,  // Boolean flag indicating if we should colorize output (default false).
		timestamp: false // Boolean flag indicating if we should prepend output with timestamps (default false). If function is specified, its return value will be used instead of timestamps.
	});

	// create config file for pinemhi and start watching .nv files if necessary
	hs.initConfig();
	// initialize transfers
	transfer.initTransfers();
	// initialize version
	au.initVersion(function(err, version) {
		logger.log('info', '[init] Running Pind %s (%s) from %s', version.version, version.sha ? version.sha.substr(0, 8) : 'unknown', version.date, {});
	});
};
