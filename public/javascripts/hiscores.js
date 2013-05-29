function HiscoresCtrl($scope, Jsonrpc) {

	$scope.hiscores = {};
	$scope.filters = [ 'hiscore' ];
	$scope.fields = [ 'key', 'name', 'year', 'url_banner_small'];

	$scope.postDataFn = function(scope, result, callback) {
		Jsonrpc.call('Pind.GetHiscores', { tableIds: _.pluck(result.rows, 'key') }, function(err, hiscores) {
			$scope.hiscores = {};
			for (var i = 0; i < hiscores.rows.length; i++) {
				var hiscore = hiscores.rows[i];
				if (!$scope.hiscores[hiscore.tableKey]) {
					$scope.hiscores[hiscore.tableKey] = [];
				}
				if (hiscore.score) {
					hiscore.score = groupdigit(hiscore.score);
				}
				hiscore.class = hiscore.user == null ? 'anon' : '';
				$scope.hiscores[hiscore.tableKey].push(hiscore);
			}
			callback(scope, result);
		});
	};

	$scope.getHiscores = function(table, type) {
		var hiscores = [];
		for (var i = 0; i < $scope.hiscores[table.key].length; i++) {
			var hiscore = $scope.hiscores[table.key][i];
			if (hiscore.type == type) {
				hiscores.push(hiscore);
			}
		}
		return hiscores;
	};
}