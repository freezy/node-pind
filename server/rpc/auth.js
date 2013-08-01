'use strict';

var logger = require('winston');
var schema = require('../database/schema');

exports.actions = function(req, res, ss) {
	req.use('session');

	return {
		authenticate: function(username, pass, rememberMe) {

			console.log('Checking login credentials. %s %s %s %s', username, pass, rememberMe);
			if (username && pass) {

				// authenticate user
				schema.User.authenticate(username, pass, function(err, user) {
					if (err) {
						logger.log('error', 'Error authenticating: ' + err);
						res({ success: false });

					// credentials check out
					} else if (user) {
						var result = { success: true };

						// set "remember me" cookie.
						if (rememberMe) {
							result.token = user.authtoken;
						}
						req.session.setUserId(user.user);
						req.session.user = user;
						req.session.save(function(){
							logger.log('info', 'Logged user saved to session: ', req.session, {});
							res(result);
						});

					// access denied
					} else {
						ss.log("Invalid credentials for " + username + ".");
						res({ success: false });
					}
				});

			} else {
				res({ success: false });
				ss.log('No credentials, ignoring.');
			}
		},

		autologin: function(username, authKey) {
			schema.User.autologin(username, authKey, function(err, user) {
				if (user) {
					req.session.setUserId(user.user);
					req.session.user = user;
					req.session.save(function(){
						logger.log('info', 'Autologged user saved to session: ', req.session, {});
						res({ success: true });
					});

				} else {
					ss.log("Invalid auth token for " + username + ".");
					res({ success: false });
				}
			});
		},

		authenticated: function() {
			logger.log('info', 'Checking if authenticated (%s)', req.session.userId);
			res(req.session.userId ? true : false);
		},

		logout: function() {
			req.session.setUserId(null);
			res(true);
		}
	};
};
