module.exports = function(module) {
	'use strict';

	/**
	 * The global controller that sits on the <body> element.
	 */
	module.controller('AppCtrl', ['$scope', '$location', 'rpc', 'userService', 'pindAuth', function($scope, $location, rpc, userService, pindAuth) {

		// ------------------------------------------------------------------------
		// status
		// ------------------------------------------------------------------------

		var offlineBar = $('#offlinebar');
		var connectionReady = false;
		$scope.statusAvailable = false;
		ss.server.on('ready', function() {
			offlineBar.addClass('bounceOutDown');
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

		$scope.$root.$on("$routeChangeStart", function(event, next, current) {
			if (!next.noAuth && !userService.isLogged) {
				console.log('No access, trying autologin..');

				$scope.connectionReady(function() {
					pindAuth.tryAutologin(function(err) {
						if (err) {
							console.log('Autologin failed: ' + err);
							console.log('Redirecting to /login, saving ' + $location.path());
							userService.redirectPath = $location.path();
							$location.path('/login');
							$scope.$apply();
						} else {
							console.log('Autologin succeeded.');
							$scope.user = userService.user;
						}
					});
				});

			} /*else if (next.adminOnly && !user.isAdmin) {
				console.log('No admin access, re-routing to /.');
			}*/
		});


		$scope.logout = function() {
			pindAuth.logout(function() {
				console.log('Logged out.');
				$location.path('/login');
			});
		};


		// ------------------------------------------------------------------------
		// global events
		// ------------------------------------------------------------------------

		$scope.$root.$on('alert', function(event, alert) {
			$scope.alert = alert;
			$scope.alert.btn = alert.btn || 'OK';
			$scope.$$phase || $scope.$apply();

			$('.modal-alert.alert-generic').modal('show');
		});

		$('.modal-alert').on('hidden', function() {
			$scope.$broadcast('alertClosed');
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

		$scope.restartDialog = function() {
			$('.modal.restart').modal().show();
		};


		// ------------------------------------------------------------------------
		// helper methods for other controllers
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


		/**
		 * Adds error class and message to a form.
		 * @param errors
		 */
		$scope.formErrors = function(errors) {
			var anim = 'pulse';
			$('.control-group').removeClass('error');
			var n = 0;
			_.each(errors, function(value, key) {
				if (!n++) {
					$('.control-group.' + key + ' input').focus().select();
				}
				$('.control-group.' + key).addClass('error');
				$('.control-group.' + key + ' > .help-block').html(value);
				$('.control-group.' + key + ' > input').addClass('animated ' + anim);
				setTimeout(function() {
					$('.control-group.' + key + ' > input').removeClass('animated ' + anim);
				}, 1000);
			});
		}

	}]);

	module.controller('NoopCtrl', ['$scope', function($scope) { }]);
};
