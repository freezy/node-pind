module.exports = function (compound) {

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
        app.use(express.bodyParser());
        app.use(express.cookieParser('couw2oewri7ph1umoew6iahluyiegleqiayoafluf7uzoaviuzo3phlayLahiEr7'));
        app.use(express.session({secret: 'priEc9luCroATie5RoePo6s5epRO6vl32lasw5aP3OEYiaHl6D99pLaP69aw21sp'}));
        app.use(express.methodOverride());
        app.use(app.router);
    });

};
