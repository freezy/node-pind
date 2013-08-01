/**
 * Forked from ss-angular's "auth" provider in order to support auto-login.
 *
 * @param module
 */
module.exports = function(module) {
	'use strict';

	module.provider('pindAuth', function() {

		var loginPath = '/login';
		var authServiceModule = 'app';
		var authTokenCookie = 'authToken';
		var usernameCookie = 'authUser';

		this.loginPath = function(path) {
			loginPath = path;
			return this;
		};
		this.authServiceModule = function(service) {
			authServiceModule = service;
			return this;
		};

		this.$get = ['userService', '$rootScope', '$location', '$q', '$log', function(userService, $rootScope, $location, $q, $log) {

/*			var routeResponse = function() {
				if (!$rootScope.authenticated) {
					var targetPath = $location.path();
					if (targetPath.indexOf(loginPath) < 0) {
						$log.log("User not logged in. Redirecting");
						$rootScope.redirectPath = targetPath;
						$location.path(loginPath);
					} //otherwise, we're already logging in
				}
			};
			$rootScope.$on('$locationChangeStart', function(current, previous) {
				routeResponse();
			});

			if (!userService.isLogged) {
				ss.rpc(authServiceModule + ".authenticated", function(response) {
					userService.isLogged = response;
				});
			}
*/

			return {
				login: function(user, password, rememberMe) {
					var deferred = $q.defer();

					if (user && password) {
						ss.rpc(authServiceModule + ".authenticate", user, password, rememberMe, function(response) {
							if (response.success) {
								userService.isLogged = true;
								deferred.resolve("Logged in");
								if (response.authToken) {
									$.cookie(authTokenCookie, response.authToken, { expires: 365 });
									$.cookie(usernameCookie, user, { expires: 365 });
								}

							} else {
								userService.isLogged = false;
								deferred.reject("Invalid");
							}
						});
					} else {
						userService.isLogged = false;
						deferred.reject("Need user and password!");
					}

					return deferred.promise;
				},

				tryAutologin: function() {
					var deferred = $q.defer();
					if ($.cookie(usernameCookie) && $.cookie(authTokenCookie)) {
						ss.rpc(authServiceModule + ".autologin", $.cookie(usernameCookie), $.cookie(authTokenCookie), function(response) {
							if (response.success) {
								userService.isLogged = true;
								deferred.resolve("Logged in");
								if (response.authToken) {
									$.cookie(authTokenCookie, response.authToken, { expires: 365 });
									$.cookie(usernameCookie, user, { expires: 365 });
								}

							} else {
								userService.isLogged = false;
								deferred.reject("Invalid");
							}
						});
					} else {
						userService.isLogged = false;
						deferred.reject("Need user and authToken.");
					}
					return deferred.promise;
				},

				logout: function() {
					var deferred = $q.defer();
					ss.rpc(authServiceModule + ".logout", function() {
						$rootScope.$apply(function(scope) {
							userService.isLogged = false;
							userService.user = null;
							$.removeCookie(authTokenCookie);
							$.removeCookie(usernameCookie);
							deferred.resolve("Success");
						});
					});
					return deferred.promise;
				}
			};
		}];
	});

};


