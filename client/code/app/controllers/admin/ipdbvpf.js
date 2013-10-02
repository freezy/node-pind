module.exports = function(module) {
	'use strict';

	module.controller('IpdbVpfItemCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

		$scope.vpfParentResult = {};

		$scope.confirm = function() {
			if ($scope.newId) {
				alert('Sure? If so, clear the URL field below and retry.');
			} else {
				$scope.rpc('vpforums.ipdbmatchConfirm', $scope.row.id, '', function() {
					$scope.$parent.$parent.$broadcast('paramsUpdated');
				});
			}
		};

		$scope.original = function() {
			if ($scope.newId) {
				alert('Sure? If so, clear the URL field below and retry.');
			} else {
				$scope.rpc('vpforums.ipdbmatchConfirm', $scope.row.id, 'OG', function() {
					$scope.$parent.$parent.$broadcast('paramsUpdated');
				});
			}
		};

		$scope.change = function() {
			if ($scope.newId) {
				$scope.rpc('vpforums.ipdbmatchConfirm', $scope.row.id, $scope.newId, function() {
					$scope.$parent.$parent.$broadcast('paramsUpdated');
				});
			} else {
				alert('No URL, ignoring.');
			}
		};

		$scope.findVpfParent = function() {
			$scope.rpc('vpforums.findParent', $scope.row.id, function(result) {
				$scope.vpfParentResult = result.rows;
				$scope.$apply();
			});
		};

	}]);
};

