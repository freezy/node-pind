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

		$scope.signup = function() {
			ss.rpc('auth.register', $scope.user, $scope.password, function(result) {
				console.log('auth result: %j', result);
				if (result.success) {
					alert('all ok');
				} else {
					if (result.errors) {
						_.each(result.errors, function(value, key) {
							$('.control-group.' + key).addClass('error');
							$('.control-group.' + key + ' .help-block').html(value);
						});
					}
				}
				if (result.alert) {
					$scope.$apply(function() {
						$scope.alert = result.alert;
						$scope.alert.btn = result.alert.btn || 'OK';
					});
					$('.modal-alert').modal('show');
				}
			});
		};

	}]);

};