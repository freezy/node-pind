
var settings = require('./settings');

module.exports = function(compound) {

    var express = require('express');
    var app = compound.app;

	function compile(str, path) {
		return stylus(str)
			.set('filename', path)
			.set('compress', false)
			.use(nib())
			.import('nib');
	}

	app.configure(function(){
		app.locals.pretty = true;
        app.use(express.static(app.root + '/public', { maxAge: 86400000 }));
        app.set('jsDirectory', '/javascripts/');
        app.set('cssDirectory', '/stylesheets/');
        app.set('cssEngine', 'stylus');
		app.set('view options', { layout: false });
//        app.use(express.bodyParser());
		app.use(express.multipart());
		app.use(express.urlencoded());
        app.use(express.cookieParser(settings.pind.secret));
        app.use(express.session({
			secret: settings.pind.secret,
			cookie: { maxAge: settings.pind.sessionTimeout }
		}));
        app.use(express.methodOverride());
        app.use(app.router);
    });

};
