/**
 * AngularJS client-side routes
 * @param module Angular app
 */
module.exports = function(module) {

	'use strict';

	module.config(['pindAuthProvider', '$routeProvider', '$locationProvider', function(pindAuthProvider, $routeProvider, $locationProvider) {

		pindAuthProvider.authServiceModule('auth');
		pindAuthProvider.loginPath('/login');

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