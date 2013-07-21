module.exports = function (module) {
	'use strict';

	/**
	 *
	 */
	module.controller('SSCtrl', ['$scope', '$location', 'pubsub', 'rpc', 'model', 'auth', function ($scope, $location, pubsub, rpc, model, auth) {
		$scope.messages = [];
		$scope.streaming = false;
		$scope.status = "";

		$scope.linkModel('example', {name: 'Tom'}, 'modelData');

		$scope.$on('ss-example', function (event, msg) {
			$scope.messages.push(msg);
		});

		$scope.toggleData = function () {
			if (!$scope.streaming) {
				$scope.streaming = true;
				$scope.status = rpc('example.on');
			}
			else {
				$scope.streaming = false;
				$scope.messages = [];
				$scope.status = rpc('example.off', 'Too random');
			}
		};

		$scope.$on('$destroy', function () {
			if ($scope.streaming) {
				rpc('example.off', 'Navigated away');
			}
		});

		$scope.logout = function () {
			var promise = auth.logout();
			promise.then(function () {
				$location.path("/");
			});
		};
//		if (!$scope.authenticated) {
//			$location.path("/login");
//		}
	}]);
};