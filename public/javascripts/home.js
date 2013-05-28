$(document).ready(function() {

});


function HomeCtrl($scope, Jsonrpc) {



	$scope.latestReleases;

	Jsonrpc.call('Table.GetAll', {
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

	Jsonrpc.call('VPForums.FindTables', { limit : 4 }, function(err, result) {
		if (err) {
			alert('Problem loading latest releases: ' + err);
		} else {
			if (result.rows.length > 0) {
				$scope.latestReleases = result.rows;
			}
		}
	});
}


function SourceItemCtrl($scope) {

}