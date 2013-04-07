var settings = require('./config/settings-mine');
load('application');
before(use('requireAdmin'));

action('tables', function (context) {
	this.title = 'Settings :: Tables';
	this.ignoreTableVids = settings.pind.ignoreTableVids;
	render();
});

action('users', function (context) {
	this.title = 'Settings :: Users';
	render();
});