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
	$scope.numpages = 5;
	$scope.limit = 10;
	$scope.resource = null;

	$scope.refresh = function() {

		if (!$scope.resource) {
			return alert('Must set "resource" attribute somewhere in scope.');
		}

		var offset = ($scope.page - 1) * $scope.limit;

		Jsonrpc.call($scope.resource, {
			offset: offset,
			limit: $scope.limit

		}, function(err, result) {
			if (err) {
				return alert(err);
			}
			$scope.data = result.rows;
			$scope.numpages = Math.ceil(result.count / $scope.limit);
			$scope.$broadcast('dataRefreshed');
			console.log('refresh done, fetched %d records, page %d of %d', result.count, $scope.page, $scope.numpages);
		});
	};

	// refresh as soon as the resource attribute is set
	$scope.$watch('resource', $scope.refresh);
	$scope.$watch('limit', $scope.refresh);
	$scope.$watch('page', $scope.refresh);
}