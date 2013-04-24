$(document).ready(function() {

});


function HomeCtrl($scope, $http) {

	$scope.table;

	ngApi($http, 'Table.GetAll', {
		fields: ['name', 'year', 'url_portrait_medium', 'url_backglass_medium'],
		limit : 1,
		offset: 6

	}, function(err, result) {
		if (err) {
			alert('Problem loading tables: ' + err);
		} else {
			if (result.rows.length > 0) {
				$scope.table = result.rows[0];
			}
		}
	});
}