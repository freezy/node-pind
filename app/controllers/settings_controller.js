var settings = require('./config/settings-mine');
var vpm = require('./app/modules/vpinmame')(app);
var vpf = require('./app/modules/vpforums')(app);
var hp = require('./app/modules/hyperpin')(app);
var ipdb = require('./app/modules/ipdb')(app);

load('application');
before(use('requireAdmin'));

action('tables', function (context) {

	this.processing = {
		hpsync: hp.isSyncing(),
		dlrom: vpm.isFetchingRoms(),
		dlmedia: false,
		fetchhs: vpm.isFetchingHiscores(),
		ipdbsync: ipdb.isSyncing()
	}
	this.title = 'Settings :: Tables';
	this.ignoreTableVids = settings.pind.ignoreTableVids;
	render();
});

action('sources', function (context) {
	this.title = 'Settings :: Sources';
	this.isDownloadingIndex = vpf.isDownloadingIndex;
	render();
});

action('transfers', function (context) {
	this.title = 'Settings :: Transfers';
	render();
});

action('users', function (context) {
	this.title = 'Settings :: Users';
	render();
});