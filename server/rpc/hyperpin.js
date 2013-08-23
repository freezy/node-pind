'use strict';

var hp = require('../modules/hyperpin');
var error = require('../modules/error');
var logger = require('winston');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce').registerSocketStream(ss);

	return {

		read: function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			hp.readTablesWithData(function(err) {
				if (err) {
					logger.log('error', '[rpc] [hyperpin] [sync] %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		},

		findMissingMedia : function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			hp.findMissingMedia(function(err) {
				if (err) {
					logger.log('error', '[rpc] [hyperpin] [findMissingMedia]  %s', err);
					res(error.api(err));
				} else {
					res();
				}
			});
		}
	};
};
