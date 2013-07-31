module.exports = function(module) {
	'use strict';

	/**
	 * The global controller that sits on the <body> element.
	 */
	module.controller('AppCtrl', ['$scope', 'rpc', 'userService', function($scope, rpc, userService) {

		// ------------------------------------------------------------------------
		// status
		// ------------------------------------------------------------------------

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
		var statusUpdated = function() {
			ss.rpc('pind.status', function(status) {
				$scope.status = status;
				$scope.$broadcast('statusUpdated');
			});
		};
		ss.event.on('statusUpdated', statusUpdated);
		$scope.$on('$destroy', function() {
			ss.event.off('statusUpdated', statusUpdated);
		});


		// ------------------------------------------------------------------------
		// access "control"
		// ------------------------------------------------------------------------

		$scope.$root.$on('$routeChangeStart', function(next) {
			if (!next.noAuth && !userService.isLogged) {
				console.log('No access, re-routing to /login.');
				return;
			}
			if (next.adminOnly && !user.isAdmin) {
				console.log('No admin access, re-routing to /.');
			}
		});


		// ------------------------------------------------------------------------
		// global events
		// ------------------------------------------------------------------------

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
		};


		// ------------------------------------------------------------------------
		// helper methods
		// ------------------------------------------------------------------------


		/**
		 * Registers arriving events.
		 *
		 * Each event has a "started" and "ended" trigger, pass functions what to do on each.
		 *
		 * @param events {object} Keys correspond to the "id" attribute the event sends, values are tuples with start event and completed event name respectively.
		 * @param startedFn {function} If set, this will be executed when the event starts, otherwise the default greying function is applied.
		 * @param completedFn {function} If set, this will be executed when the event completes, otherwise the default ungrey function is applied.
		 */
		$scope.registerEvents = function(events, startedFn, completedFn) {

			// set default actions
			if (!startedFn) {
				startedFn = function(id) {
					$('#' + id + ' > button > i').addClass('spin');
					$('.row.footer > h2').addClass('disabled');
					$('.action').addClass('disabled').find('button').attr('disabled', 'disabled');
				};
			}
			if (!completedFn) {
				completedFn = function() {
					$('.row.footer > h2').removeClass('disabled');
					$('.action').removeClass('disabled').find('button').removeAttr('disabled', 'disabled');
					$('.action > button > i').removeClass('spin');
				};
			}

			// on load, initialize status.
			var updateStatus = function() {
				_.each($scope.status.processing, function(value, key) {
					if (value && _.contains(_.keys(events), key)) {
						events[key] && _.isFunction(events[key][2]) ? events[key][2](key) : startedFn(key);
					}
				});
			};
			if (!$scope.statusAvailable) {
				$scope.$on('statusAvailable', function() {
					$scope.$apply(updateStatus);
				});
			} else {
				updateStatus();
			}

			// wrap callbacks so we can update the status
			var _startedFn = function(data) {
				$scope.status.processing[data.id] = true;
				events[data.id] && _.isFunction(events[data.id][2]) ? events[data.id][2](data.id) : startedFn(data.id);
			};
			var _completedFn = function(data) {
				$scope.status.processing[data.id] = false;
				events[data.id] && _.isFunction(events[data.id][3]) ? events[data.id][3](data.id) : completedFn(data.id);
			};

			// events
			_.each(events, function(e) {
				ss.event.on(e[0], _startedFn);
				ss.event.on(e[1], _completedFn);
			});
			$scope.$on('$destroy', function() {
				_.each(events, function(e) {
					ss.event.off(e[0], _startedFn);
					ss.event.off(e[1], _completedFn);
				});
			});
		};

	}]);

	module.controller('NoopCtrl', ['$scope', function($scope) { }]);
};