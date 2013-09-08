module.exports = function(module) {
	'use strict';

	module.controller('IpdbMatchItemCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

		$scope.confirm = function() {
			$scope.rpc('vpforums.ipdbmatchConfirm', $scope.row.id, function() {
				$scope.$parent.$broadcast('paramsUpdated');
			});
		}
	}]);
};

