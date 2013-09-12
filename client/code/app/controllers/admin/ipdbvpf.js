module.exports = function(module) {
	'use strict';

	module.controller('IpdbMatchItemCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

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

	}]);
};

