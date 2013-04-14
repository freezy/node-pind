load('application');
before(use('requireUser'));

var express = require('express');
var api = require('./app/modules/api');

action('handle', function() {
//	req.session.destroy();
	console.log('*** API request: %j', req.body);
	api.handle(req, res);
});
