module.exports = function(compound) {

	var hs = require(compound.root + '/app/modules/hiscore')(compound.app);
	var trns = require(compound.root + '/app/modules/transfer')(compound.app);

	// create config file for pinemhi and start watching .nv files if necessary
	hs.initConfig();
	// initialize transfers
	trns.initTransfers();

	console.log('Pind is now initialized.');
};
