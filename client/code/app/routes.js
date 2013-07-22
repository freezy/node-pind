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
			.when('/login', { templateUrl: 'auth-login.html' })
			.when('/app', { templateUrl: 'app.html' })
			.when('/another', { templateUrl: 'anotherpage.html' })
			.otherwise({ redirectTo: '/' });

		// use html5 push state
		$locationProvider.html5Mode(true);

	}]);
};