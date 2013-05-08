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

		Jsonrpc.call($scope.resource, {
			limit: $scope.limit

		}, function(err, result) {
			if (err) {
				return alert(err);
			}
			$scope.data = result.rows;
			$scope.pages = Math.ceil(result.rows.count / $scope.limit);
		});
	};

	// refresh as soon as the resource attribute is set
	$scope.$watch('resource', $scope.refresh);
	$scope.$watch('limit', $scope.refresh);
}