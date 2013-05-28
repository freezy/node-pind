/**
 * Controller for JSON-RPC enabled lists.
 * @param $scope
 * @param Jsonrpc
 * @constructor
 */
function DataCtrl($scope, Jsonrpc) {

	$scope.data = [];

	$scope.page = 1;
	$scope.numpages = 1;
//	$scope.limit = 10;
	$scope.resource = null;
	$scope.search = '';
	$scope.sort = '';
//	$scope.filters = [];

//	$scope.mapperFn = null;
//	$scope.postDataFn = null;

	$scope.reset = function() {
		$scope.page = 1;
		$scope.numpages = 1;
//		$scope.limit = 10;
		$scope.search = '';
		$scope.sort = '';
		$scope.filters = [];
		$scope.$broadcast('paramsReset');
	}

	var refresh = function() {

		if (!$scope.resource) {
			return alert('Must set "resource" attribute somewhere in scope.');
		}

		var params = {
			offset: ($scope.page - 1) * $scope.limit,
			limit: $scope.limit
		};

		if ($scope.search && $scope.search.length != 1) {
			params.search = $scope.search;
		}

		if ($scope.fields && $scope.fields.length != 1) {
			params.fields = $scope.fields;
		}

		if ($scope.filters && $scope.filters.length > 0) {
			params.filters = $scope.filters;
		}

		if ($scope.sort && $scope.sort.length > 0) {
			params.order = $scope.sort;
		}

		Jsonrpc.call($scope.resource, params, function(err, result) {
			if (err) {
				return alert(err);
			}
			// copy rows to result, with mapper function if available.
			var setData = function($scope, result) {
				if ($scope.mapperFn) {
					$scope.data = _.map(result.rows, $scope.mapperFn);
				} else {
					$scope.data = result.rows;
				}
				$scope.numpages = Math.ceil(result.count / $scope.limit);
				$scope.$broadcast('dataUpdated');
			}

			// do something else first if postDataFn is set.
			if ($scope.postDataFn) {
				$scope.postDataFn($scope, result, function($scope, result) {
					setData($scope, result);
				});
			} else {
				setData($scope, result);
			}
		});
	};

	// refresh on explicit params updated event and as soon as resource is set.
	$scope.$watch('resource', refresh);
	$scope.$on('paramsUpdated', refresh);
	$scope.$on('paramsReset', refresh);
}

var pindAppModule = angular.module('pind', ['ngSanitize']);

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
			scope.$on('paramsReset', function() {
				element.find('li').removeClass('active');
			});
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
 * Defines a unordered list as sort pills.
 *
 * Attributes:
 *   - value: defines the name of the scope's sort value.
 */
pindAppModule.directive('sort', function() {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {

			element.find('li a').click(function(event) {
				event.preventDefault();

				// clear all
				$(this).parents('ul').find('li').removeClass('current');

				// set current
				var parent = $(this).parents('li');
				parent.addClass('current');
				$(this).blur();

				// update and refresh
				scope[attrs.value] = parent.data('sort');
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
			scope.$on('paramsReset', function() {
				element.find('input').val('');
			});
			var wait = parseInt(attrs.wait) ? parseInt(attrs.wait) : 300;
			var keyTimer;
			element.find('input').on('keyup', function(e) {
				// ESC clears search value
				if (e.keyCode == 27) {
					$(this).val('');
					scope[attrs.value] = '';
					scope.$broadcast('paramsUpdated');
				} else {
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
						if (i == 0) {
							scope[attrs.value] = values[i];
						}
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
 * Control bar on top
 */
pindAppModule.directive('controls', function() {
	return {
		restrict: 'C',
		link: function(scope, element) {
			scope.$on('dataUpdated', function() {

				// results
				if (scope.data && scope.data.length > 0) {
					$(element).show();

				// no results due to filtering
				} else if (scope.filters.length > 0 || (scope.search && scope.search.length > 1)) {
					$(element).show();

				// no results due to no data
				} else {
					$(element).hide();
				}
			});
		}
	}
});


/*
 * Data block
 */
pindAppModule.directive('data', function() {
	return {
		restrict: 'C',
		link: function(scope, element) {
			scope.$on('dataUpdated', function() {

				// results
				if (scope.data && scope.data.length > 0) {
					$(element).show();

				// no results due to filtering
				} else if (scope.filters.length > 0 || (scope.search && scope.search.length > 1)) {
					$(element).slideUp(200);

				// no results due to no data
				} else {
					$(element).hide();
				}
			});
		}
	}
});

/*
 * Info block when a search or filter returned no result.
 */
pindAppModule.directive('noresult', function() {
	return {
		restrict: 'C',
		link: function(scope, element) {
			element.find('button').click(function() {
				scope.reset();
			});
			scope.$on('dataUpdated', function() {

				// results
				if (scope.data && scope.data.length > 0) {
					$(element).hide();

				// no results due to filtering
				} else if (scope.filters.length > 0 || (scope.search && scope.search.length > 1)) {
					$(element).fadeIn(500);

				// no results due to no data
				} else {
					$(element).hide();
				}
			});
		}
	}
});

/*
 * Info block when data was not yet populated.
 */
pindAppModule.directive('nodata', function() {
	return {
		restrict: 'C',
		link: function(scope, element) {
			scope.$on('dataUpdated', function() {

				// results
				if (scope.data && scope.data.length > 0) {
					$(element).fadeOut(200);

				// no results due to filtering
				} else if (scope.filters.length > 0 || (scope.search && scope.search.length > 1)) {
					$(element).hide();

				// no results due to no data
				} else {
					$(element).fadeIn(500);
				}
			});
		}
	}
});

/*
 * Renders a thumb that fades in when downloaded.
 *
 * Attributes:
 *   - fileid: VPF-ID of the screenshot to render.
 */
pindAppModule.directive('thumb', function() {
	return {
		restrict: 'E',
		replace: true,
		transclude: true,
		template:
			'<div class="pull-left thumb-wrapper"><a href="#">' +
				'<div class="thumb"></div>' +
				'<div class="thumb-placeholder"></div>' +
				'</a></div>',
		link: function(scope, element, attrs) {

			attrs.$observe('fileid', function(value) {
				var a = element.find('a');
				var thumb = element.find('.thumb');

				a.attr('href', 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&full=1&id=' + value);
				thumb.css('background-image', "url('http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&id=" + value + "')");
				thumb.waitForImages({
					each: function() {
						var that = $(this);
						that.parent('a').colorbox({
							transition: "fade",
							photo: true,
							maxWidth: '99%',
							maxHeight: '99%'
						});
						that.addClass('loaded');
					},
					finished: function() {
						// preload hires images
//						$parent.find('.thumb-wrapper > a').each(function() {
//							$('<img/>')[0].src = $(this).attr('href');
//						});
					},
					waitForAll: true
				});
			});
		}
	}
});

pindAppModule.filter('groupdigit', function() {
	return function(nStr) {
		nStr += '';
		var x = nStr.split('.');
		var x1 = x[0];
		var x2 = x.length > 1 ? '.' + x[1] : '';
		var rgx = /(\d+)(\d{3})/;
		while (rgx.test(x1)) {
			x1 = x1.replace(rgx, '$1' + ',' + '$2');
		}
		return x1 + x2;
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