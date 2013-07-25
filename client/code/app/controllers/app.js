module.exports = function(module) {
	'use strict';

	/**
	 * The global controller that sits on the <body> element.
	 */
	module.controller('AppCtrl', ['$scope', 'rpc', function($scope, rpc) {

		var connectionReady = false;
		$scope.statusAvailable = false;
		ss.server.on('ready', function() {
			connectionReady = true;
			ss.rpc('pind.status', function(status) {
				$scope.status = status;
				$scope.statusAvailable = true;
				$scope.$broadcast('statusAvailable');
			});
		});

		$scope.connectionReady = function(callback) {
			if (connectionReady) {
				callback();
			} else {
				var fn = function() {
					callback();
					ss.server.off('ready', fn);
				};
				ss.server.on('ready', fn);
			}
		};

		$scope.restart = function() {

			Jsonrpc.call('Pind.Restart', {}, function(err) {
				if (err) {
					return alert('ERROR: ' + err);
				}
				var counting = $('.modal.restarting');
				counting.modal({
					show: true,
					keyboard: false,
					backdrop: 'static'
				});
				var count = 5;
				var timer = setInterval(function() {
					counting.find('.modal-footer > p').html('Refreshing in ' + count + ' seconds.');
					if (count == 0) {
						clearInterval(timer);
						counting.modal('hide');
						location.reload();
					}
					count--;
				}, 1000);
			});
		};

		$scope.logout = function() {
			rpc('auth.logout');
			location.reload();
		};

		$scope.restartDialog = function() {
			$('.modal.restart').modal().show();
		}

	}]);

	module.controller('NoopCtrl', ['$scope', function($scope) { }]);
};