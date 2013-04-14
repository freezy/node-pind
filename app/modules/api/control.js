var api = require('./../api');
var hp = require('./../hyperpin');

var ControlApi = function() {
	return {
		name : 'Control',

		/**
		 * Inserts a coin into the pinball machine.
		 *
		 * @param req Request object
		 * @param params Parameter object containing "slot".
		 * @param callback
		 * @constructor
		 */
		InsertCoin : function(req, params, callback) {
			if ('slot' in params) {
				var slot = params.slot;
				console.log('inserting coin into slot ' + slot + '...');
				hp.insertCoin(req.session.user, slot, function(err, result) {
					if (err) {
						console.log(err);
						throw new Error(err);
					} else {
						callback(result);
					}
				});

			} else {
				callback(api.error('Parameter "slot" is missing.'));
			}
		}
	};
};

exports.api = new ControlApi();