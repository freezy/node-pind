var ss = require('socketstream');
var clc = require('cli-color');
var http = require('http');
var logger = require('winston');

require('buffertools').extend();  // extend Buffer.prototype

if (require('./server/modules/settings').validate()) {

	var settings = require('./config/settings-mine.js');

	// Define a single-page client
	ss.client.define('main', {
		view: 'index.jade',
		css: ['libs', 'animations.css', 'fonts.css', 'definitions.styl', 'layout.styl', 'element.styl', 'module.styl'],
		code: ['libs', 'app'],
		tmpl: '*'
	});

	ss.session.options.maxAge = 2.6 * Math.pow(10, 9);

	// Serve this client on the root URL
	ss.http.route('/', function(req, res) {
		res.serveClient('main');
	});

	ss.http.middleware.prepend(require('./server/middleware/asset.js').middleware());

	// Code Formatters
	ss.client.formatters.add(require('ss-stylus'));
	ss.client.formatters.add(require('ss-jade'));
	ss.client.templateEngine.use('angular');

	// Responders
	ss.responders.add(require('ss-angular'), { pollFreq: 60000 });

	// Minimize and pack assets if you type: SS_ENV=production node app.js
	if (ss.env == 'production') {
		ss.client.packAssets();
	}

	// override logger
	ss.api.log = function() {
		var args = Array.prototype.slice.call(arguments);
		logger.log('info', clc.bgBlue(args.join(' ')));
	};

	// init modules
	require('./server/initializers/pind.js')();

	// Start web server
	var server = http.Server(ss.http.middleware);
	server.listen(parseInt(settings.pind.port));

	// Start SocketStream
	ss.start(server);

} else {
	logger.log('error', '[pind] Error in settings file, closing down.');
}

