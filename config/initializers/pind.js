module.exports = function(compound) {

	var hs = require(compound.root + '/app/modules/hiscore')(compound.app);
	var trns = require(compound.root + '/app/modules/transfer')(compound.app);
	var au = require(compound.root + '/app/modules/autoupdate')();

	// create config file for pinemhi and start watching .nv files if necessary
	hs.initConfig();
	// initialize transfers
	trns.initTransfers();
	// initialize version
	au.initVersion(function(err, version) {
		console.log('Running Pind ' + version.version + ' from ' + version.date);
	});
};
