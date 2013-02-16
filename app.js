/**
 * Node.js Pinball Daemon
 * Author : freezy
 */

var express = require('express');
var http = require('http');
var stylus = require('stylus');
var app = express();
var nib = require('nib');

var httpPort = 80;
var publicPath = '/app/public';

function compile(str, path) {
	return stylus(str)
		.set('filename', path)
		.set('compress', false)
		.use(nib())
		.import('nib');
}

app.configure(function() {
	app.set('port', httpPort);
	app.set('views', __dirname + '/app/server/views');
	app.set('view engine', 'jade');
	app.locals.pretty = true;
//	app.use(express.favicon());
//	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({ secret : 'JUc9nUqeRepE9TepEn3xAphasu8AfrAcrecrAstApuDafratrUY86ubrAZU5rETR' }));
	app.use(express.methodOverride());
	app.use(require('stylus').middleware({
		src : __dirname + publicPath,
		compile : compile
	}));
	app.use(express.static(__dirname + publicPath));
});

app.configure('development', function() {
	app.use(express.errorHandler());
});

require('./app/server/router')(app);

var server = http.createServer(app).listen(app.get('port'), function() {
	console.log("Express server listening on port " + app.get('port'));
})
