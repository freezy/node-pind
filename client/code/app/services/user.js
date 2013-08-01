module.exports = function(module) {
	'use strict';

	module.service('userService', function() {
		return {
			redirectPath: '/',
			isLogged: false,
			user: null
		};
	});
};
