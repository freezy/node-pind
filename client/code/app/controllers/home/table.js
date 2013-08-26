module.exports = function(module) {
	'use strict';

	module.controller('TableCtrl', ['$scope', '$element', '$routeParams', function($scope, $element, $routeParams) {

		$scope.hiscores = [];

		$scope.rpc('table.one', { id: $routeParams.key }, function(result) {
			$scope.table = result;

			Highcharts.setOptions({
				chart: {
					spacingRight: 0,
					marginRight: 1,
					backgroundColor: null,
					style: {
						fontFamily: '"Open Sans", "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif'
					}
				}
			});

			if (result.audits) {
				renderAudits(result);
			}

			$scope.$apply();
		});

		$scope.rpc('pind.getHiscores', { tableIds: [ $routeParams.key ] }, function(hiscores) {
			for (var i = 0; i < hiscores.rows.length; i++) {
				var hiscore = hiscores.rows[i];

				hiscore.class = hiscore.user == null ? 'anon' : '';
				$scope.hiscores.push(hiscore);
			}
			$scope.$apply();
		});

		$scope.getHiscores = function(type) {
			var hiscores = [];
			for (var i = 0; i < $scope.hiscores.length; i++) {
				var hiscore = $scope.hiscores[i];
				if (hiscore.type == type) {
					hiscores.push(hiscore);
				}
			}
			return hiscores;
		};
	}]);
};

function renderAudits(result) {

	var defaultConfig = {
		chart: { type: 'spline' },
		title: null,
		credits: { enabled: false },
		legend: { enabled: false },
		colors: [ '#e09d55' ],
		xAxis: {
			title: {
				style: {
					color: '#e09d55',
					fontWeight: 'bold'
				}
			},
			lineColor: 'rgba(0,0,0,0.2)',
			labels: {
				overflow: 'justify',
				staggerLines: 2
			}
		},
		yAxis: {
			title: {
				text: 'GAMES',
				style: {
					color: '#e09d55',
					fontWeight: 'bold'
				}
			},
			min: 0,
			minorGridLineWidth: 0,
			gridLineWidth: 1,
			gridLineColor: 'rgba(0,0,0,0.1)',
			alternateGridColor: null
		},
		plotOptions: {
			spline: {
				lineWidth: 4,
				states: {
					hover: {
						lineWidth: 5
					}
				},
				marker: {
					enabled: false
				}
			}
		},
		series: [
			{
				name: 'Number of Games'
			}
		]
	};

	if (result.audits.scoreHistogram) {
		var scoreConfig = _.clone(defaultConfig);
		scoreConfig.series[0].data = _.map(result.audits.scoreHistogram, function(p) {
			return [ p.score, p.num ];
		});
		scoreConfig.xAxis.categories = _.pluck(result.audits.scoreHistogram, 'score');
		scoreConfig.xAxis.title.text = 'SCORE';
		$('.graph-score-histogram').highcharts(scoreConfig);
	}

	if (result.audits.playtimeHistogram) {
		var dur = function(d) {
			switch (d) {
				case 0:
					return '0';
				case 90:
					return '1:30';
				case 150:
					return '2:30';
				default:
					if (d < 600) {
						return juration.stringify(d, { format: 'micro' }).replace(/m/, 'min');
					} else {
						return juration.stringify(d, { format: 'micro' });
					}
			}
		};
		var playtimeConfig = _.clone(defaultConfig);
		playtimeConfig.series[0].data = _.map(result.audits.playtimeHistogram, function(p) {
			return [ dur(p.duration), p.num ];
		});
		playtimeConfig.xAxis.categories = _.map(result.audits.playtimeHistogram, function(p) {
			return dur(p.duration);
		});
		scoreConfig.xAxis.title.text = 'PLAY TIME';
		$('.graph-playtime-histogram').highcharts(scoreConfig);
	}
}