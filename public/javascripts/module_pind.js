
var pindAppModule = angular.module('pind', ['ngSanitize']);

/**
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
				} else if (ret.result && ret.result.error) {
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