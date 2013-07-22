module.exports = function(module) {
	'use strict';

	module.provider('pindAuth', function() {

		var loginPath = '/login';
		var authServiceModule = 'app';

		this.loginPath = function(path) {
			loginPath = path;
			return this;
		};
		this.authServiceModule = function(service) {
			authServiceModule = service;
			return this;
		};

		this.$get = ['$rootScope', '$location', '$q', '$log', function($rootScope, $location, $q, $log) {

			var routeResponse = function() {
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

			if (!$rootScope.authenticated) {
				ss.rpc(authServiceModule + ".authenticated", function(response) {
					$rootScope.$apply(function(scope) {
						$rootScope.authenticated = response;
						routeResponse();
					});
				});
			}

			return {
				login: function(user, password, rememberMe, authKey) {
					var deferred = $q.defer();
					ss.rpc(authServiceModule + ".authenticate", user, password, rememberMe, authKey, function(response) {
						$rootScope.$apply(function(scope) {
							if (response.success) {
								scope.authenticated = true;
								deferred.resolve("Logged in");
								if (response.authToken) {
									$.cookie('authToken', response.authToken, { expires: 365 });
								}

							} else {
								scope.authenticated = false;
								deferred.reject("Invalid");
							}
						});
					});
					return deferred.promise;
				},
				logout: function() {
					var deferred = $q.defer();
					ss.rpc(authServiceModule + ".logout", function() {
						$rootScope.$apply(function(scope) {
							scope.authenticated = null;
							$.removeCookie('authToken');
							deferred.resolve("Success");
						});
					});
					return deferred.promise;
				}
			};
		}];
	});

};


