/**
 * AngularJS client-side routes
 * @param module Angular app
 */
module.exports = function(module) {

	'use strict';

	module.config(['authProvider', '$routeProvider', '$locationProvider', function(authProvider, $routeProvider, $locationProvider) {

		authProvider.authServiceModule('auth');
		authProvider.loginPath('/login');

		// setup routing
		$routeProvider
			.when('/login', { controller: 'AuthCtrl', templateUrl: 'login.html' })
			.when('/app', { controller: 'SSCtrl', templateUrl: 'app.html' })
			.when('/another', { templateUrl: 'anotherpage.html' })
	//		.otherwise({redirectTo: '/app'});

		// use html5 push state
		$locationProvider.html5Mode(true);

	}]);
};