module.exports = function(module) {
	'use strict';

	module.controller('HomeCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

/*		Jsonrpc.call('Table.GetAll', {
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
		});*/
	}]);


	module.controller('LatestReleasesCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {
		$scope.limit = 4;
		$scope.sort = 'latest'
	}]);


	module.controller('LatestGamesCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {
		$scope.limit = 3;
		$scope.fields = ['name', 'year', 'manufacturer', 'url', 'url_backglass_medium' ];
	}]);


	module.controller('LatestHiscoresCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {
		$scope.limit = 3;
		$scope.sort = 'latestHiscores';
		$scope.filters = [ 'hiscoreAny' ];
		$scope.fields = [ 'key', 'name', 'year', 'url_banner_small'];
	}]);


	module.controller('SourceItemCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

	}]);

};
