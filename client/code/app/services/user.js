module.exports = function(module) {
	'use strict';

	module.service('userService', function() {
		return {
			isLogged: false,
			user: null
		};
	});
};


