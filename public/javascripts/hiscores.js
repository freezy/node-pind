function HiscoresCtrl($scope, Jsonrpc) {

	$scope.tables = [];
	$scope.hiscores = {};

	$scope.getHiscores = function(table, type) {
		var hiscores = [];
		for (var i = 0; i < $scope.hiscores[table.key].length; i++) {
			var hiscore = $scope.hiscores[table.key][i];
			if (hiscore.type == type) {
				hiscores.push(hiscore);
			}
		}
		return hiscores;
	}

	Jsonrpc.call('Pind.GetHiscores', { }, function(err, result) {

		for (var i = 0; i < result.rows.length; i++) {
			var hiscore = result.rows[i];
			if (!$scope.hiscores[hiscore.tableKey]) {
				$scope.hiscores[hiscore.tableKey] = [];
			}
			if (hiscore.score) {
				hiscore.score = groupdigit(hiscore.score);
			}
			hiscore.class = hiscore.user == null ? 'anon' : '';
			$scope.hiscores[hiscore.tableKey].push(hiscore);
		}

		Jsonrpc.call('Table.GetAll', {
			filters: [ 'hiscore' ],
			fields: [ 'key', 'name', 'year', 'url_banner_small']
		}, function(err, result) {
			$scope.tables = result.rows;
		});
	});
}