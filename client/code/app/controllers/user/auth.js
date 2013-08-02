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

		$scope.register = function() {

		};

	}]);

};