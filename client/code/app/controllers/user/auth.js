module.exports = function(module) {
	'use strict';

	/**
	 *
	 */
	module.controller('AuthCtrl', ['$scope', '$location', '$log', 'pindAuth', 'userService', function($scope, $location, $log, pindAuth, userService) {
		$scope.rememberme = true;

		$scope.login = function() {
			$scope.showError = false;
			var promise = pindAuth.login($scope.user, $scope.password, $scope.rememberme);
			promise.then(function(reason) {
				$log.log(reason);
				var newPath = '/';
				if (userService.redirectPath) {
					newPath = userService.redirectPath;
				}
				$location.path(newPath);

			}, function(reason) {
				$log.log(reason);
				$scope.showError = true;
				$scope.errorMsg = "Invalid login. The username and pass for the example app is user/pass";
			});
		};

		$('input[name="user"]').focus();
		$scope.$on('alertClosed', function() {
			$('input[name="user"]').focus();
		});

		$scope.signup = function() {
			ss.rpc('auth.register', $scope.user, $scope.password, function(result) {
				console.log('auth result: %j', result);
				if (result.success) {
					$location.path('/login');
				} else {
					if (result.errors) {
						$scope.formErrors(result.errors);
					}
				}
				if (result.alert) {
					$scope.$root.$broadcast('alert', result.alert);
				}
			});
		};

	}]);

};