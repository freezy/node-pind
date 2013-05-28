$(document).ready(function() {

});

function TablesCtrl($scope, Jsonrpc) {

	$scope.tables = [];

	Jsonrpc.call('Table.GetAll', {
		filters: [ 'hiscore' ],
		fields: [ 'key', 'name', 'year', 'manufacturer', 'url_backglass_medium', 'url_banner_small', 'url_square_small', 'url_square_medium', 'url_widescreen_medium']
	}, function(err, result) {
		$scope.tables = result.rows;
	});
}
