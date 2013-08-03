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
			var checkSuccess = function(response, callback) {
				if (response.success) {
					userService.isLogged = true;
					userService.user = response.user;
					if (response.authToken) {
						$.cookie(authTokenCookie, response.authToken, { expires: 365 });
						$.cookie(usernameCookie, response.user.user, { expires: 365 });
					} else {
						$.removeCookie(authTokenCookie);
						$.removeCookie(usernameCookie);
					}
					callback();

				} else {
					userService.isLogged = false;
					callback('Login failed.');
				}
			};

			return {
				login: function(user, password, rememberMe, callback) {

					if (user && password) {
						ss.rpc(authServiceModule + ".authenticate", user, password, rememberMe, function(response) {
							checkSuccess(response, callback);
						});
					} else {
						userService.isLogged = false;
						callback('Need credentials.');
					}
				},

				tryAutologin: function(callback) {
					if ($.cookie(usernameCookie) && $.cookie(authTokenCookie)) {
						console.log(authServiceModule + ".autologin");
						ss.rpc(authServiceModule + ".autologin", $.cookie(usernameCookie), $.cookie(authTokenCookie), function(response) {
							console.log('got response: %s', response);
							checkSuccess(response, callback);
						});
					} else {
						userService.isLogged = false;
						callback('Need username and cookie.');
					}
				},

				logout: function(callback) {
					ss.rpc(authServiceModule + ".logout", function() {
						$rootScope.$apply(function() {
							userService.isLogged = false;
							userService.user = null;
							$.removeCookie(authTokenCookie);
							$.removeCookie(usernameCookie);
						});
						callback();
					});
				}
			};
		}];
	});

};


