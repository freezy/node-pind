module.exports = function(module) {
	'use strict';

	module.controller('HomeCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {
		$scope.rpc('user.getLeaderboard', function(result) {
			if (_.isArray(result) && result.length > 0) {
				$scope.leaderboard = result;
			} else {
				$scope.leaderboard = [ { user: 'NO DATA.' }];
			}
		});
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
