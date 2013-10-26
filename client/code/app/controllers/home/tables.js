module.exports = function(module) {
	'use strict';

	module.controller('TablesCtrl', ['$scope', function($scope) {
		$scope.filters = [ 'enabledOnly' ];
	}]);
};
