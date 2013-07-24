module.exports = function(module) {
	'use strict';

	module.controller('HiscoreCtrl', ['$scope', function($scope) {

		$scope.hiscores = {};
		$scope.filters = [ 'hiscoreAny' ];
		$scope.fields = [ 'key', 'name', 'year', 'url_banner_small'];

		$scope.postDataFn = function(scope, result, callback) {
			ss.rpc('pind.getHiscores', { tableIds: _.pluck(result.rows, 'key') }, function(hiscores) {
				$scope.hiscores = {};
				for (var i = 0; i < hiscores.rows.length; i++) {
					var hiscore = hiscores.rows[i];
					if (!$scope.hiscores[hiscore.tableKey]) {
						$scope.hiscores[hiscore.tableKey] = [];
					}
					hiscore.class = hiscore.user == null ? 'anon' : '';
					$scope.hiscores[hiscore.tableKey].push(hiscore);
				}
				callback(scope, result);
			});
		};

		$scope.getHiscores = function(table, type) {
			var hiscores = [];
			if (!table) {
				alert('table not set ('  + type + ')');
				return [];
			}
			for (var i = 0; i < $scope.hiscores[table.key].length; i++) {
				var hiscore = $scope.hiscores[table.key][i];
				if (hiscore.type == type) {
					hiscores.push(hiscore);
				}
			}
			return hiscores;
		};
	}]);
};

