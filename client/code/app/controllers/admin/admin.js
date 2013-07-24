module.exports = function(module) {
	'use strict';

	module.controller('AdminCtrl', ['$scope', '$log', '$element', 'rpc', function($scope, $log, $element, rpc) {

		// ------------------------------------------------------------------------
		// dmd console code
		// ------------------------------------------------------------------------

		var timer;
		var consoleElem = $element.find('#console');
		var consoleSpan = consoleElem.find('span');
		var consoleLog = function(notice) {
			var timeout = notice.timeout ? notice.timeout : 1500;
			if (!consoleElem.is(':visible')) {
				consoleElem.slideDown(200);
			}
			consoleSpan.html(notice.msg);
			clearTimeout(timer);
			timer = setTimeout(function() {
				consoleElem.slideUp(200);
			}, timeout);
		};

		ss.event.on('console', consoleLog);
		$scope.$on('$destroy', function() {
			ss.event.off('console', consoleLog);
		});
	}]);
};
