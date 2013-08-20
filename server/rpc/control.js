'use strict';

var hp = require('../modules/hyperpin');
var logger = require('winston');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce').registerSocketStream(ss);

	return {

		/**
		 * Inserts a coin into the pinball machine.
		 * @param slot Which slot, 1 or 2
		 */
		insertCoin: function(slot) {
			logger.log('info', '[rpc] [control] Inserting coin into slot %s by %s', slot, req.session.user.user);
			hp.insertCoin(req.session.user, slot, function(err, result) {
				if (err) {
					logger.log('error', '[rpc] [hyperpin] [sync] %s', err);
					res(error.api(err));
				} else {
					res(result);
				}
			});
		}
	};
};
