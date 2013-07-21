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
			}
		}
	});

};