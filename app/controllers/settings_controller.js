var settings = require('./config/settings-mine');
var vpm = require('./app/modules/vpinmame')(app);

load('application');
before(use('requireAdmin'));

action('tables', function (context) {

	this.processing = {
		hpsync: false,
		dlrom: vpm.isFetchingRoms(),
		dlmedia: false,
		fetchhs: vpm.isFetchingHiscores(),
		ipdbsync: false
	}
	this.title = 'Settings :: Tables';
	this.ignoreTableVids = settings.pind.ignoreTableVids;
	render();
});

action('users', function (context) {
	this.title = 'Settings :: Users';
	render();
});