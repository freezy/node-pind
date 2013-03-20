exports.routes = function (map) {
    map.resources('tables');

	// login and register
	map.get('login', 'users#login');
	map.post('login', 'users#login', { as: 'loginPost'});
	map.get('signup', 'users#signup');
	map.post('signup', 'users#signup', { as: 'signupPost'});

    // Generic routes. Add all your routes below this line
    // feel free to remove generic routes
    map.all(':controller/:action');
    map.all(':controller/:action/:id');
};
