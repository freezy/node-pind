
var settings = require('./settings');

module.exports = function(compound) {

    var express = require('express');

	var app = compound.app;
	var io = require('socket.io').listen(compound.server);
	var vpm = require(compound.root + '/app/modules/vpinmame')(app);

	function compile(str, path) {
		return stylus(str)
			.set('filename', path)
			.set('compress', false)
			.use(nib())
			.import('nib');
	}

	app.configure(function(){
		app.locals.pretty = false;
        app.use(express.static(app.root + '/public', { maxAge: 86400000 }));
		app.set('socket.io', io.sockets);
        app.set('jsDirectory', '/javascripts/');
        app.set('cssDirectory', '/stylesheets/');
        app.set('cssEngine', 'stylus');
		app.set('view options', { layout: false });
        app.use(express.bodyParser());
        app.use(express.cookieParser(settings.pind.secret));
        app.use(express.session({
			secret: settings.pind.secret,
			cookie: { maxAge: settings.pind.sessionTimeout }
		}));
        app.use(express.methodOverride());
        app.use(app.router);
    });

	// create config file for pinemhi and start watching .nv files if necessary
	vpm.init(io.sockets);
};
