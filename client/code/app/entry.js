// This file automatically gets called first by SocketStream and must always exist

// Make 'ss' available to all modules and the browser console
window.ss = require('socketstream');

require('ssAngular');
var directives = angular.module('app.directives', []);
var filters = angular.module('app.filters', []);

// load directives
require('/directives/global')(directives);
require('/directives/data')(directives);
require('/directives/admin')(directives);

// load filters
require('/filters')(filters);

// this is the angular application
var app = angular.module('app', ['app.filters', 'app.directives', 'ssAngular']);

// load services
require('/services/user')(app);

// load providers
require('/providers/auth')(app);

// configure angular routing
require('/routes')(app);

// setup angular controllers
require('/controllers/app')(app);
require('/controllers/data')(app);

require('/controllers/home/hiscore')(app);
require('/controllers/home/home')(app);

require('/controllers/user/auth')(app);

require('/controllers/admin/admin')(app);
require('/controllers/admin/tables')(app);
require('/controllers/admin/transfer')(app);
require('/controllers/admin/sources')(app);
require('/controllers/admin/user')(app);
require('/controllers/admin/global')(app);

require('/controllers/example')(app);

ss.server.on('ready', function() {

	jQuery(function() {

		require('/app');

	});

});
