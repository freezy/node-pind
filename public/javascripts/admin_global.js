$(document).ready(function() {
	//$('.modal.update-found').modal('show');
});

function GlobalCtrl($scope, Jsonrpc) {

	$scope.version;
	$scope.date;
	$scope.url;
	$scope.sha;
	$scope.checkBtnClass = '';
	$scope.checking = false;

	$scope.checkVersionUpdate = function() {
		$scope.checkBtnClass = 'spin';
		$scope.checking = true;
		Jsonrpc.call('Pind.GetAvailableUpdate', {}, function(err, version) {
			$scope.checkBtnClass = '';
			$scope.checking = false;
			if (err) {
				return alert('ERROR: ' + err);
			}
			if (version.noUpdates) {
				alert('No updates found.');
			} else {
				alert(version);
			}
		});
	}

	Jsonrpc.call('Pind.GetVersion', {}, function(err, version) {
		$scope.version = version.version;
		$scope.date = version.dateSince;
		$scope.sha = version.sha.substr(0, 8);
		$scope.url = version.url;
	});

}
