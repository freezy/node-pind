module.exports = function (module) {
	'use strict';

	/**
	 * Defines namespace and method of an api call.
	 *
	 * Attributes:
	 *   - resource: namespace and method, separated by ".", e.g. "Table.GetAll".
	 */
	module.directive('resource', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				scope.resource = attrs.resource;
				scope.$broadcast('resourceAvailable');
			}
		}
	});

	/*
	 * Defines a unordered list as filter pills.
	 *
	 * Attributes:
	 *   - value: defines the name of the scope's filters array.
	 */
	module.directive('filters', function() {
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
					if (!scope[attrs.value]) {
						scope[attrs.value] = [];
					}
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
	module.directive('sort', function() {
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
	module.directive('searchbox', function() {
		return {
			restrict: 'E',
			replace: true,
			template:
				'<div class="input-prepend top-pill">' +
					'<span class="add-on"><i class="icon search"></i></span>' +
					'<input type="text" class="search input-medium input-pill" placeholder="keywords">' +
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
	module.directive('numrows', function() {
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
	module.directive('pager', function() {
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
	module.directive('controls', function() {
		return {
			restrict: 'C',
			link: function(scope, element) {
				scope.$on('dataUpdated', function() {

					// results
					if (scope.data && scope.data.length > 0) {
						$(element).show();

						// no results due to filtering
					} else if ((scope.filters && scope.filters.length > 0) || (scope.search && scope.search.length > 1)) {
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
	module.directive('data', function() {
		return {
			restrict: 'C',
			link: function(scope, element) {
				scope.$on('dataUpdated', function() {

					// results
					if (scope.data && scope.data.length > 0) {
						$(element).show();

						// no results due to filtering
					} else if ((scope.filters && scope.filters.length > 0) || (scope.search && scope.search.length > 1)) {
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
	module.directive('noresult', function() {
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
					} else if ((scope.filters && scope.filters.length > 0) || (scope.search && scope.search.length > 1)) {
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
	module.directive('nodata', function() {
		return {
			restrict: 'C',
			link: function(scope, element) {
				scope.$on('dataUpdated', function() {

					// results
					if (scope.data && scope.data.length > 0) {
						$(element).fadeOut(200);

						// no results due to filtering
					} else if ((scope.filters && scope.filters.length > 0) || (scope.search && scope.search.length > 1)) {
						$(element).hide();

						// no results due to no data
					} else {
						$(element).fadeIn(500);
					}
				});
			}
		}
	});


	module.directive('sortable', ['rpc', function(rpc) {
		return function(scope, element, attrs) {
			if (scope.$last) {
				// http://isocra.com/2008/02/table-drag-and-drop-jquery-plugin/
				$(element).parents('tbody').tableDnD({
					onDrop: function(table, row) {
						var next = $(row).next();
						var prev = $(row).prev();
						rpc(attrs.sortable, {
							id: $(row).attr('id'),
							between: {
								prev: prev && prev.hasClass('queued') ? prev.attr('id') : 0,
								next: next && next.hasClass('queued') ? next.attr('id') : 0
							}
						});
					},
					dragHandle: '.dragHandle',
					onDragClass: 'dragging'
				});
			}
		};
	}]);

	module.directive('deletable', ['rpc', function(rpc) {
		return function(scope, element, attrs) {
			if (!scope.transfer.startedAt || scope.transfer.completedAt || scope.transfer.failedAt) {
				$(element).find('li.link.delete').click(function() {
					var id = attrs.id;
					rpc(attrs.deletable, { id: id });
				});
			} else {
				$(element).find('li.link.delete').addClass('disabled');
			}

		};
	}]);
};