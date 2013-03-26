var util = require('util');
var c = compound.utils.stylize.$;
var log = compound.utils.debug;
var express = require('express');
var api = require('./app/modules/api')(app);

publish('requireUser', requireUser);

before('protect from forgery', function () {
  protectFromForgery('4a63d1756c1801a833cdd50ece1d192ecba3fafa');
});

before(requireUser, { except: [ 'login', 'loginPost', 'signup', 'signupPost', 'api' ] });
//before(requireAuth, { only: 'api' });

var auth = express.basicAuth(User.authenticate);

// generic actions
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

function requireUser() {
	if (req.session.user) {
		next();
	} else {
		console.log('req = %s', util.inspect(req));
		log(c('[auth] No valid session, redirecting to login page.').grey);
		req.session.redirectUrl = req.originalUrl;
		redirect(path_to.login);
	}
}
