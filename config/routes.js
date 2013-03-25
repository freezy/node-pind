exports.routes = function (map) {

	// map.resources('tables');

	// login and register
	map.get('login', 'users#login');
	map.post('login', 'users#login', { as: 'loginPost'});
	map.get('logout', 'users#logout');
	map.get('signup', 'users#signup');
	map.post('signup', 'users#signup', { as: 'signupPost'});

	// home
	map.root('home#tables', { as: 'root' });

	// media
	map.get('asset/hp/banner/:id.png', 'asset#banner', { as: 'asset_banner'});
	map.get('asset/hp/portrait/:id.small.png', 'asset#portrait_small', { as: 'asset_portrait_small'});

	// api
	map.post('api', 'application#api');


	// Generic routes. Add all your routes below this line
	// feel free to remove generic routes
	// map.all(':controller/:action');
	// map.all(':controller/:action/:id');
};
