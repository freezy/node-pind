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

			.when('/', { templateUrl: 'home-index.html' })
			.when('/hiscores', { templateUrl: 'home-hiscores.html' })
			.when('/tables', { templateUrl: 'home-tables.html' })
			.when('/coin', { templateUrl: 'home-coin.html' })

			.when('/admin', { templateUrl: 'admin-tables.html', adminOnly: true })
			.when('/admin/sources', { templateUrl: 'admin-sources.html', adminOnly: true })
			.when('/admin/downloads', { templateUrl: 'admin-transfers.html', adminOnly: true })
			.when('/admin/users', { templateUrl: 'admin-users.html', adminOnly: true })
			.when('/admin/global', { templateUrl: 'admin-global.html', adminOnly: true })

			.when('/login', { templateUrl: 'auth-login.html', noAuth: true })
			.when('/signup', { templateUrl: 'auth-signup.html', noAuth: true })

			.otherwise({ redirectTo: '/' });

		// use html5 push state
		$locationProvider.html5Mode(true);

	}]);
};