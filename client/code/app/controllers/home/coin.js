module.exports = function(module) {
	'use strict';

	module.controller('CoinCtrl', ['$scope', '$log', 'rpc', function($scope) {

		$scope.statusReady(function(status) {
			$scope.credits = status.user.credits + ' CREDITS';
		});
	}]);
};
