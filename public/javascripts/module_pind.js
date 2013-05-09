
var pindAppModule = angular.module('pind', []);

/*
 * Defines namespace and method of an api call.
 *
 * Attributes:
 *   - resource: namespace and method, separated by ".", e.g. "Table.GetAll".
 */
pindAppModule.directive('resource', function() {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			scope.resource = attrs.resource;
		}
	}
});

/*
 * Defines a unordered list as filter pills.
 *
 * Attributes:
 *   - value: defines the name of the scope's filters array.
 */
pindAppModule.directive('filters', function() {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			element.find('li a').click(function(event) {
				event.preventDefault();
				var parent = $(this).parents('li');
				var filter = parent.data('filter');
				if (parent.hasClass('active')) {
					// remove from array
					scope[attrs.value].splice(scope.filters.indexOf(filter));
				} else {
					// add to array
					scope[attrs.value].push(filter);
				}
				parent.toggleClass('active');
				scope.$broadcast('paramsUpdated');
			});
		}
	}
});

/*
 * Renders a search box with real-time search.
 *
 * Attributes:
 *   - value: defines the name of the scope's search query value.
 *   - wait:  how long to wait for additional keypresses before running the search. default 300ms.
 */
pindAppModule.directive('searchbox', function() {
	return {
		restrict: 'E',
		replace: true,
		template:
			'<div class="input-prepend input-pill">' +
				'<span class="add-on"><i class="icon search"></i></span>' +
				'<input type="text" class="search input-medium" placeholder="keywords">' +
			'</div>',
		link: function(scope, element, attrs) {
			var wait = parseInt(attrs.wait) ? parseInt(attrs.wait) : 300;
			var keyTimer;
			element.find('input').on('keyup', function() {
				var query = $(this).val();
				if (query.length != 1) {
					window.clearTimeout(keyTimer);
					keyTimer = setTimeout(function() {
						// TODO clear sort
						// TODO reset page
						scope[attrs.value] = query;
						scope.$broadcast('paramsUpdated');
					}, wait);
				}
			});
		}
	};
});


/*
 * Renders a dropdown with number of items to show.
 *
 * Attributes:
 *   - value: defines the name of the scope's search query value.
 *   - wait:  how long to wait for additional keypresses before running the search. default 300ms.
 */
pindAppModule.directive('numrows', function() {
	return {
		restrict: 'E',
		replace: true,
		template: '<select></select>',
		link: function(scope, element, attrs) {
			try {
				var values = JSON.parse(attrs.selection);
				if (values && values.length > 0) {
					for (var i = 0; i < values.length; i++) {
						element.append('<option value="' + values[i] + '">' + values[i] + '</option>');
					}
				}
				element.on('change', function() {
					scope[attrs.value] = element.val();
					scope.$broadcast('paramsUpdated');
				})
			} catch (e) {
				// ignore.
			}
		}
	}
});

/*
 * Renders the pagination pills.
 *
 * Attributes:
 *   - page: name of the scope's "current page" variable
 *   - pages: name of the scope's "number of pages" variable
 */
pindAppModule.directive('pager', function() {
	return {
		restrict: 'E',
		template:
			'<div>' +
				'<ul>' +
				'<li class="first disabled"><a><i class="icon arrow-left"></i></a></li>' +
				'<li class="current"><a>1</a></li>' +
				'<li class="last disabled"><a><i class="icon arrow-right"></i></a></li>' +
				'</ul>' +
				'</div>',
		replace: true,
		link: function(scope, element, attrs) {

			var render = function() {
				var page = scope.$eval(attrs.page);
				var pages = scope.$eval(attrs.pages);

				element.find('li:not(.first):not(.last)').remove();
				var lastSkipped = false;
				for (var i = pages; i > 0; i--) {

					// on large number of pages, don't render all the pagination bar
					if (pages > 9 && ((i > 2 && i < (page - 1)) || (i > (page + 1) && i < (pages - 1)))) {
						if (!lastSkipped) {
							element.find('li.first').after($('<li class="spacer"></li>'));
						}
						lastSkipped = true;
						continue;
					}
					lastSkipped = false;

					var li = $('<li class="p' + i + (page == i ? ' current' : '') + '"><a href="#">' + i + '</a>');
					if (page != i) {
						li.find('a').click(function(event) {
							event.preventDefault();
							scope.$apply(attrs.page + ' = ' + parseInt($(this).html()));
							scope.$broadcast('paramsUpdated');
						});
					} else {
						li.find('a').click(function(event) {
							event.preventDefault();
						});
					}
					// insert into dom
					element.find('li.first').after(li);
				}
				element.find('li').removeClass('disabled');
				if (page == 1) {
					element.find('li.first').addClass('disabled');
				}
				if (page == pages || pages == 0) {
					element.find('li.last').addClass('disabled');
				}

				// enable prev/next buttons
				element.find('li.first a').off('click').click(function(event) {
					event.preventDefault();
					if (page > 1) {
						scope[attrs.page]--;
						scope.$broadcast('paramsUpdated');
					}
				});
				element.find('li.last a').off('click').click(function(event) {
					event.preventDefault();
					if (page < pages) {
						scope[attrs.page]++;
						scope.$broadcast('paramsUpdated');
					}
				});
			}
			scope.$on('dataUpdated', render);
		}
	}
});

/*
 * Simple JSON-RPC 2 implementation using Angular's $http service.
 */
pindAppModule.factory('Jsonrpc', function($http) {

	return {

		call: function(method, params, callback) {
			$http({
				url: '/api',
				method: 'POST',
				headers: {
					'Content-Type' : 'application/json'
				},
				data: JSON.stringify({ jsonrpc: '2.0', id: Math.random(), method: method, params: params})

			}).success(function(ret) {
				if (ret.error) {
					callback(ret.error.message, ret.error);
				} else if (ret.result.error) {
					callback(typeof ret.result.error.message === 'object' ? JSON.stringify(ret.result.error.message) : ret.result.error.message, ret.result.error);
				} else {
					callback(null, ret.result);
				}

			}).error(function(data) {
				if (data.status == 401) {
					window.location = $('head meta[name="login"]').attr('content');
				} else {
					alert(data.error);
				}
			});
		}
	};
});