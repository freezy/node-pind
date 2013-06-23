$(document).ready(function() {

});

function TableCtrl($scope, $element, Jsonrpc) {

	$scope.table;

	Jsonrpc.call('Table.Get', { id: $element.data('id') }, function(err, result) {
		$scope.table = result;
	});
}
