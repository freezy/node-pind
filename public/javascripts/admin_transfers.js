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

function TransferCtrl($scope, $http) {

	$scope.transfers = [];
	$scope.numrows = 10;

	console.log('numrows = %s', $scope.numrows);

	ngApi($http, 'Transfer.GetAll', {
		limit: $scope.numrows
//		filters: [ ],
//		fields: [ ]
	}, function(err, result) {
		$scope.transfers = result.rows;
	});
}

angular.module('phonecatServices', ['ngResource']).factory('Phone', function($resource) {
	return $resource('phones/:phoneId.json', {}, {
			query: {method:'GET', params:{phoneId:'phones'}, isArray:true}
	});
});
