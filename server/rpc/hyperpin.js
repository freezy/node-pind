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
					ss.publish.all('console', { msg: 'ERROR: ' + err, type: 'error', timeout: 60000 });
					res(error.api(err));
				} else {
					ss.publish.all('dataUpdated', 'table');
				}
			});
		}
	};
};
