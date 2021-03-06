module.exports = function(module) {
	'use strict';

	module.controller('CoinCtrl', ['$scope', function($scope) {

		var updateCredits = function() {
			$scope.credits = $scope.status.user.credits + ' CREDIT' + ($scope.status.user.credits != 1 ? 'S' : '');
			$scope.safeApply();
		};

		$scope.statusReady(updateCredits);
		$scope.$on('statusUpdated', updateCredits);

		$scope.insertCoin = function(slot) {
			$scope.rpc('control.insertCoin', slot, function() {

			});
		}
	}]);
};
