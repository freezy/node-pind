$(document).ready(function() {

/*	api('Table.GetAll', { filters: [ 'hiscore' ], fields: [ 'name', 'year', 'url_banner_small'] }, function(err, result) {
		var content = $('.bytable');
		for (var i = 0; i < result.rows.length; i++) {
			var t = result.rows[i];
			content.append($('<p><h3>' + t.name + '</h3><img src="' + t.url_banner_small + '"></p>'));
		}
	});*/
});


function HiscoresCtrl($scope, $http) {

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

	ngApi($http, 'Pind.GetHiscores', { }, function(err, result) {

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

		ngApi($http, 'Table.GetAll', {
			filters: [ 'hiscore' ],
			fields: [ 'key', 'name', 'year', 'url_banner_small']
		}, function(err, result) {
			$scope.tables = result.rows;
		});
	});
}