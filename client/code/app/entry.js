// This file automatically gets called first by SocketStream and must always exist

// Make 'ss' available to all modules and the browser console
window.ss = require('socketstream');

ss.server.on('disconnect', function() {
	console.log('Connection down :-(');
});

ss.server.on('reconnect', function() {
	console.log('Connection back up :-)');
});

require('ssAngular');
var directives = angular.module('app.directives', []);
var filters = angular.module('app.filters', []);

// load directives
require('/directives/global')(directives);
require('/directives/data')(directives);

// load filters
require('/filters')(filters);

// this is the angular application
var app = angular.module('app', ['app.filters', 'app.directives', 'ssAngular']);

// load providers
require('/providers/auth')(app);

// configure angular routing
require('/routes')(app);

// setup angular controllers
require('/controllers/auth')(app);
require('/controllers/example')(app);


//require('/controllers/controllers');
ss.server.on('ready', function() {

	jQuery(function() {

		require('/app');

	});

});
