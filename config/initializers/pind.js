module.exports = function(compound) {

	var hs = require(compound.root + '/app/modules/hiscore')(compound.app);

	// create config file for pinemhi and start watching .nv files if necessary
	hs.initConfig();

	console.log('Pind is now initialized.');
};
