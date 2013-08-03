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

		var anim = 'pulse';
		$scope.signup = function() {
			ss.rpc('auth.register', $scope.user, $scope.password, function(result) {
				console.log('auth result: %j', result);
				if (result.success) {
					$location.path('/login');
				} else {
					if (result.errors) {
						$('.control-group').removeClass('error');
						var n = 0;
						_.each(result.errors, function(value, key) {
							if (!n++) {
								$('.control-group.' + key + ' input').focus().select();
							}
							$('.control-group.' + key).addClass('error');
							$('.control-group.' + key + ' > .help-block').html(value);
							$('.control-group.' + key + ' > input').addClass('animated ' + anim);
							setTimeout(function() {
								$('.control-group.' + key + ' > input').removeClass('animated ' + anim);
							}, 1000);
						});
					}
				}
				if (result.alert) {
					$scope.$root.$broadcast('alert', result.alert);
				}
			});
		};

	}]);

};