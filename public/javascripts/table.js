$(document).ready(function() {

});

function TableCtrl($scope, $element, Jsonrpc) {

	$scope.table;

	Jsonrpc.call('Table.Get', { id: $element.data('id') }, function(err, result) {
		$scope.table = result;

		Highcharts.setOptions({
			chart: {
				spacingLeft: 0,
				spacingRight: 0,
				marginRight: 1,
				backgroundColor: null,
				style: {
					fontFamily: '"Open Sans", "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif'
				}
			}
		});

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
			series: [{
				name: 'Number of Games'
			}]
		};

		var scoreConfig = _.clone(defaultConfig);
		scoreConfig.series[0].data =  _.map(result.audits.scoreHistogram, function(p) {
			return [ p.score, p.num ];
		});
		scoreConfig.xAxis.categories = _.pluck(result.audits.scoreHistogram, 'score');
		scoreConfig.xAxis.title.text = 'SCORE';
		$('.graph-score-histogram').highcharts(scoreConfig);


		var dur = function(d) {
			switch(d) {
				case 0: return '0';
				case 90: return '1:30';
				case 150: return '2:30';
				default:
					if (d < 600) {
						return juration.stringify(d, { format: 'micro' }).replace(/m/, 'min');
					} else {
						return juration.stringify(d, { format: 'micro' });
					}
			}
		}
		var playtimeConfig = _.clone(defaultConfig);
		playtimeConfig.series[0].data =  _.map(result.audits.playtimeHistogram, function(p) {
			return [ dur(p.duration), p.num ];
		});
		playtimeConfig.xAxis.categories = _.map(result.audits.playtimeHistogram, function(p) {
			return dur(p.duration);
		});
		scoreConfig.xAxis.title.text = 'PLAY TIME';
		$('.graph-playtime-histogram').highcharts(scoreConfig);


	});
}