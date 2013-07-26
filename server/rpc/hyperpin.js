var hp = require('../modules/hyperpin')();
var logger = require('winston');

exports.actions = function(req, res, ss) {
	req.use('session');

	require('../modules/announce')().registerSocketStream(ss);

	return {
		sync: function() {

			hp.syncTablesWithData(function(err) {
				if (err) {
					logger.log('error', '[rpc] [hyperpin] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		}
	};
};
