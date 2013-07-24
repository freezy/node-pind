module.exports = function(module) {
	'use strict';

	/**
	 * Controller for JSON-RPC enabled lists.
	 * @param $scope
	 * @param Jsonrpc
	 * @constructor
	 */
	module.controller('DataCtrl', ['$scope', function($scope) {

		// those can be overloaded by parent scope
//		$scope.limit = 10;
//		$scope.filters = [];
//		$scope.mapperFn = null;
//		$scope.postDataFn = null;

		$scope.data = [];

		$scope.page = 1;
		$scope.numpages = 1;
		$scope.resource = null;
		$scope.search = '';
		$scope.sort = '';


		$scope.reset = function() {
			$scope.page = 1;
			$scope.numpages = 1;
			$scope.search = '';
			$scope.sort = '';
			$scope.filters = [];
			$scope.$broadcast('paramsReset');
		};

		$scope.refresh = function() {

			if (!$scope.resource) {
				return alert('Must set "resource" attribute somewhere in scope.');
			}

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

			ss.rpc($scope.resource, params, function(result) {

				// copy rows to result, with mapper function if available.
				var setData = function($scope, result) {
					if ($scope.mapperFn) {
						$scope.data = _.map(result.rows, $scope.mapperFn);
					} else {
						$scope.data = result.rows;
					}
					$scope.numpages = Math.ceil(result.count / $scope.limit);
					$scope.$broadcast('dataUpdated');
					$scope.$apply();
				};

				// do something else first if postDataFn is set.
				if ($scope.postDataFn) {
					$scope.postDataFn($scope, result, function($scope, result) {
						setData($scope, result);
					});
				} else {
					setData($scope, result);
				}
			});
		};

		$scope.connectionReady(function() {
			if (!$scope.resource) {
				$scope.$on('resourceAvailable', $scope.refresh);
			} else {
				$scope.refresh();
			}
		});

		var autorefresh = function(what) {
			if ($scope.resource && $scope.resource.substr(0, $scope.resource.indexOf('.')) == what) {
				$scope.refresh();
			}
		};

		// refresh on explicit params updated event and as soon as resource is set.
		$scope.$on('paramsUpdated', $scope.refresh);
		$scope.$on('paramsReset', $scope.refresh);

		ss.server.on('ready', $scope.refresh);
		ss.event.on('dataUpdated', autorefresh);

		// cleanup on exit
		$scope.$on('$destroy', function() {
			ss.server.off('ready', $scope.refresh);
			ss.event.off('dataUpdated', autorefresh);
		});
	}]);
};
