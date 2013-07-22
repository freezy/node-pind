module.exports = function(module) {
	'use strict';

	/**
	 * Controller for JSON-RPC enabled lists.
	 * @param $scope
	 * @param Jsonrpc
	 * @constructor
	 */
	module.controller('DataCtrl', ['$scope', 'rpc', function($scope, rpc) {

		$scope.data = [];

		$scope.page = 1;
		$scope.numpages = 1;
//		$scope.limit = 10;
		$scope.resource = null;
		$scope.search = '';
		$scope.sort = '';
//		$scope.filters = [];

//		$scope.mapperFn = null;
//		$scope.postDataFn = null;

		$scope.reset = function() {
			$scope.page = 1;
			$scope.numpages = 1;
//			$scope.limit = 10;
			$scope.search = '';
			$scope.sort = '';
			$scope.filters = [];
			$scope.$broadcast('paramsReset');
		};

		var refresh = function() {

			var params = {
				offset: ($scope.page - 1) * $scope.limit,
				limit: $scope.limit
			};

			if ($scope.search && $scope.search.length != 1) {
				params.search = $scope.search;
			}

			if ($scope.fields && $scope.fields.length != 1) {
				params.fields = $scope.fields;
			}

			if ($scope.filters && $scope.filters.length > 0) {
				params.filters = $scope.filters;
			}

			if ($scope.sort && $scope.sort.length > 0) {
				params.order = $scope.sort;
			}

			rpc("table.all", params).then(function(result) {

				alert('OK');

				// copy rows to result, with mapper function if available.
				var setData = function($scope, result) {
					if ($scope.mapperFn) {
						$scope.data = _.map(result.rows, $scope.mapperFn);
					} else {
						$scope.data = result.rows;
					}
					$scope.numpages = Math.ceil(result.count / $scope.limit);
					$scope.$broadcast('dataUpdated');
				};

				// do something else first if postDataFn is set.
				if ($scope.postDataFn) {
					$scope.postDataFn($scope, result, function($scope, result) {
						setData($scope, result);
					});
				} else {
					setData($scope, result);
				}
			}, function(reason) {
				alert('Failed: ' + reason);
			});
		};

		// refresh on explicit params updated event and as soon as resource is set.
		$scope.$on('paramsUpdated', refresh);
		$scope.$on('paramsReset', refresh);
		refresh();

	}]);
};
