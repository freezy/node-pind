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
	map.get('hiscores', 'home#hiscores');
	map.get('tables', 'home#tables');

	// media
	map.get('asset/hp/logo/:id.png', 'asset#logo', { as: 'asset_logo'});
	map.get('asset/hp/square/:id.small.png', 'asset#square_small', { as: 'asset_square_small'});
	map.get('asset/hp/square/:id.medium.png', 'asset#square_medium', { as: 'asset_square_medium'});
	map.get('asset/hp/banner/:id.small.png', 'asset#banner_small', { as: 'asset_banner_small'});
	map.get('asset/hp/banner/:id.png', 'asset#banner', { as: 'asset_banner'});
	map.get('asset/hp/widescreen/:id.small.png', 'asset#widescreen_small', { as: 'asset_widescreen_small'});
	map.get('asset/hp/widescreen/:id.medium.png', 'asset#widescreen_medium', { as: 'asset_widescreen_medium'});
	map.get('asset/hp/portrait/:id.small.png', 'asset#portrait_small', { as: 'asset_portrait_small'});
	map.get('asset/hp/portrait/:id.medium.png', 'asset#portrait_medium', { as: 'asset_portrait_medium'});
	map.get('asset/hp/backglass/:id.small.png', 'asset#backglass_small', { as: 'asset_backglass_small'});
	map.get('asset/hp/backglass/:id.medium.png', 'asset#backglass_medium', { as: 'asset_backglass_medium'});

	// api
	map.post('api', 'api#handle');

	// admin
	map.get('admin/tables', 'settings#tables', { as: 'admin' });
	map.get('admin/users', 'settings#users', { as: 'admin_users' });

	// Generic routes. Add all your routes below this line
	// feel free to remove generic routes
	// map.all(':controller/:action');
	// map.all(':controller/:action/:id');
};
