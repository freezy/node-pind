exports.routes = function (map) {

	// map.resources('tables');

	// login and register
	map.get('login', 'users#login');
	map.post('login', 'users#login', { as: 'loginPost'});
	map.get('logout', 'users#logout');
	map.get('signup', 'users#signup');
	map.post('signup', 'users#signup', { as: 'signupPost'});

	// home
	map.root('home#index', { as: 'root' });
	map.get('coin', 'home#coin');

	// media
	map.get('asset/hp/logo/:id.png', 'asset#logo', { as: 'asset_logo'});
	map.get('asset/hp/banner/:id.png', 'asset#banner', { as: 'asset_banner'});
	map.get('asset/hp/portrait/:id.small.png', 'asset#portrait_small', { as: 'asset_portrait_small'});

	// api
	map.post('api', 'api#api');

	// admin
	map.get('admin/tables', 'settings#tables', { as: 'admin' });
	map.get('admin/users', 'settings#users', { as: 'admin_users' });

	// Generic routes. Add all your routes below this line
	// feel free to remove generic routes
	// map.all(':controller/:action');
	// map.all(':controller/:action/:id');
};
