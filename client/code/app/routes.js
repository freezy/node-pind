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

			.when('/admin', { templateUrl: 'settings-tables.html' })
			.when('/admin/sources', { templateUrl: 'settings-sources.html' })
			.when('/admin/downloads', { templateUrl: 'settings-transfers.html' })
			.when('/admin/users', { templateUrl: 'settings-users.html' })
			.when('/admin/global', { templateUrl: 'settings-global.html' })

			.when('/login', { templateUrl: 'auth-login.html' })

			.otherwise({ redirectTo: '/' });

		// use html5 push state
		$locationProvider.html5Mode(true);

	}]);
};