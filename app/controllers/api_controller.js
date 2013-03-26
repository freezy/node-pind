var express = require('express');

var api = require('./app/modules/api')(app);

//before(requireAuth, { only: 'api' });

var auth = express.basicAuth(User.authenticate);

action('api3', function(context) {
	auth(context.req, context.res, next);
}, function(context) {
	req.session.destroy();
	api.handle(context.req, context.res);
});

action('api', function(context) {
	req.session.destroy();
	api.handle(context.req, context.res);
});

function requireAuth() {
	var auth = express.basicAuth(User.authenticate);
	auth(req, res, next);
}
