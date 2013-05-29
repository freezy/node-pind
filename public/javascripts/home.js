function HomeCtrl($scope, Jsonrpc) {

	$scope.latestReleases = [];
	$scope.latestGames = [];

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
}

function LatestReleasesCtrl($scope) {
	$scope.limit = 4;
	$scope.sort = 'latest'
}

function LatestGamesCtrl($scope) {
	$scope.limit = 3;
	$scope.fields = ['name', 'year', 'manufacturer', 'url_backglass_medium' ];
}

function LatestHiscoresCtrl($scope) {
	$scope.limit = 3;
	$scope.filters = [ 'hiscoreAny' ];
	$scope.fields = [ 'key', 'name', 'year', 'url_banner_small'];
}

function SourceItemCtrl($scope) {

}