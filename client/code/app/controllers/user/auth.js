module.exports = function(module) {
	'use strict';

	/**
	 *
	 */
	module.controller('AuthCtrl', ['$scope', '$location', '$log', 'pindAuth', function($scope, $location, $log, pindAuth) {
		$scope.rememberme = true;

		$scope.processAuth = function() {
			$scope.showError = false;
			var promise = pindAuth.login($scope.user, $scope.password, $scope.rememberme);
			promise.then(function(reason) {
				$log.log(reason);
				var newPath = '/app';
				if ($scope.redirectPath) {
					newPath = $scope.redirectPath;
				}
				$location.path(newPath);
			}, function(reason) {
				$log.log(reason);
				$scope.showError = true;
				$scope.errorMsg = "Invalid login. The username and pass for the example app is user/pass";
			});
		};
	}]);

};