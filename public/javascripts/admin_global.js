function GlobalCtrl($scope, Jsonrpc) {

	$scope.version;
	$scope.date;


	Jsonrpc.call('Pind.GetVersion', {}, function(err, version) {
		$scope.version = version.version;
		$scope.date = version.dateSince;
	});

}
