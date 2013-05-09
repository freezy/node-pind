$(document).ready(function() {

/*	var render = function($tbody, rows) {
		$tbody.empty();
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i];
			var tr = $('<tr><td></td><td>' + row.title + '</td></tr>');
			$(tr).appendTo($tbody);
		}
	};

	var config = {
		id: 'transfers',
		body: 'table tbody',
		renderRows: render,
		apiCall: 'Transfer.GetAll'
	};


	// load data on startup
	enableData(config);
	refreshData(config);*/
});


function DataCtrl($scope, Jsonrpc) {

	$scope.data = [];

	$scope.page = 1;
	$scope.numpages = 1;
	$scope.limit = 10;
	$scope.resource = null;
	$scope.search = '';
	$scope.filters = [];

	var refresh = function() {

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

		if ($scope.filters && $scope.filters.length > 0) {
			params.filters = $scope.filters;
		}

		Jsonrpc.call($scope.resource, params, function(err, result) {
			if (err) {
				return alert(err);
			}
			$scope.data = result.rows;
			$scope.numpages = Math.ceil(result.count / $scope.limit);
			$scope.$broadcast('dataUpdated');
		});
	};

	// refresh on explicit params updated event and as soon as resource is set.
	$scope.$watch('resource', refresh);
	$scope.$on('paramsUpdated', refresh);

}