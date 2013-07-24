module.exports = function (module) {
	'use strict';

	module.filter('groupdigit', function() {
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

	module.filter('duration', function() {
		return function(dStr) {
			dStr = Math.floor(dStr / 1000);
			if (!dStr) {
				return dStr;
			}
			return juration.stringify(dStr, { format: 'micro' });
		}
	});

	module.filter('githubRange', function() {
		return function(result) {
			var from = result.fromSha.substr(0, 7);
			var to = result.toSha.substr(0, 7);
			return '<a href="https://github.com/' + result.repo + '/compare/' + from + '...' + to + '" target="_blank" class="tt">' + from + '...' + to + '</a>';
		}
	});

};