var settings = require('./config/settings-mine');
load('application');
before(use('requireAdmin'));

action('index', function (context) {
	this.title = 'Settings';
	this.ignoreTableVids = settings.pind.ignoreTableVids;
	render();
});