load('application');
before(use('requireUser'));

var express = require('express');
var api = require('./app/modules/api')(app);

//before(requireAuth, { only: 'api' });

var auth = express.basicAuth(User.authenticate);

action('authhandle', function(context) {
	auth(context.req, context.res, next);
}, function(context) {
	req.session.destroy();
	api.handle(context.req, context.res);
});


action('handle', function() {
//	req.session.destroy();
	console.log('*** API request: %j', req.body);
	api.handle(req, res);
});

function requireAuth() {
	auth(req, res, next);
}
