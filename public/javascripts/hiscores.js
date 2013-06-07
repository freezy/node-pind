$(document).ready(function() {
});


function HiscoresCtrl($scope, Jsonrpc) {

	$scope.hiscores = {};
	$scope.filters = [ 'hiscoreAny' ];
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
}


/*
 * Enables the hiscore flipper that shows extended high scores when
 * hovering over the image.
 */
pindAppModule.directive('slider', function() {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {

			var running = false;
			var duration = parseInt(attrs['slider']);
			var top = element.find('.thumbnail-content .top');
			var bottom = element.find('.thumbnail-content .bottom');

			element.find('.thumbnail > img').mouseenter(function() {

				if (running) {
					top.stop();
					bottom.stop();
				}
				running = true;
				top.animate({ top : '0px' }, duration, function() {
					running = false;
				});
				bottom.animate({ top : '250px' }, duration, function() {
					running = false;
				});

			}).mouseleave(function() {
				if (running) {
					top.stop();
					bottom.stop();
				}
				running = true;
				top.animate({ top: '-250px' }, duration, function() {
					running = false;
				});
				bottom.animate({ top: '0px' }, duration, function() {
					running = false;
				});
			});
		}
	}
});
