module.exports = function(module) {
	'use strict';

	module.controller('AuthCtrl', ['$scope', '$location', '$log', 'pindAuth', 'userService', function($scope, $location, $log, pindAuth, userService) {
		$scope.rememberme = true;

		// set cursor to user input box
		$('input[name="user"]').focus();
		$scope.$on('alertClosed', function() {
			$('input[name="user"]').focus();
		});


		$scope.login = function() {
			pindAuth.login($scope.user, $scope.password, $scope.rememberme, function(err) {

				if (err) {
					if (!$scope.user) {
						$scope.$root.$broadcast('alert', {
							title: 'Well..',
							message: 'How to put this... In order to login, you need to put <b>a username</b> into the field.',
							btn: 'If you say so'
						});
					} else {
						$scope.$root.$broadcast('alert', {
							title: 'Sorry.',
							message: 'Login failed. That means either username or password were wrong.',
							btn: 'Retry'
						});
					}
					return;
				}

				var newPath = '/';
				if (userService.redirectPath && !userService.redirectPath.match(/login/i) && !userService.redirectPath.match(/signup/i)) {
					newPath = userService.redirectPath;
				}
				$location.path(newPath);
				$scope.user = userService.user;
			});
		};


		$scope.signup = function() {
			ss.rpc('auth.register', $scope.user, $scope.password, function(result) {
				if (result.success) {
					$location.path('/login');
				} else if (result.errors) {
					$scope.formErrors(result.errors);
				}
				if (result.alert) {
					$scope.$root.$broadcast('alert', result.alert);
				}
			});
		};

	}]);

};