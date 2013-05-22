var settings = require('./config/settings-mine');
var vpm = require('./app/modules/vpinmame')(app);
var vpf = require('./app/modules/vpforums')(app);
var hp = require('./app/modules/hyperpin')(app);
var hs = require('./app/modules/hiscore')(app);
var ipdb = require('./app/modules/ipdb')(app);
var trns = require('./app/modules/transfer')(app);

load('application');
before(use('requireAdmin'));

action('tables', function(context) {

	this.processing = {
		hpsync: hp.isSyncing(),
		dlrom: vpm.isFetchingRoms(),
		dlmedia: false,
		fetchhs: hs.isFetchingHiscores(),
		ipdbsync: ipdb.isSyncing()
	}
	this.title = 'Settings :: Tables';
	this.ignoreTableVids = settings.pind.ignoreTableVids;
	render();
});

action('sources', function(context) {
	this.title = 'Settings :: Sources';
	this.isDownloadingIndex = vpf.isDownloadingIndex;
	render();
});

action('transfers', function(context) {
	this.title = 'Settings :: Transfers';
	trns.getStatus(function(err, status) {
		if (err) {
			this.status = err;
		} else {
			this.status = status;
		}
		render();
	});
	this.ngController = 'TransferCtrl';
});

action('users', function(context) {
	this.title = 'Settings :: Users';
	render();
});