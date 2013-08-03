'use strict';

var _ = require('underscore');
var logger = require('winston');
var schema = require('../database/schema');

var hs = require('../modules/hiscore');

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
						req.session.save(function() {
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

		register: function(username, password) {
			var alert = {};
			if (username && password) {
				logger.log('info', '[rpc] [auth] Registering user...');
				var now = new Date().getTime();
				schema.User.count().success(function(num) {
					schema.User.find({ where: { user: username }}).success(function(user) {
						if (!user) {
							user = schema.User.build({
								user: username,
								pass: password,
								admin: num == 0
							});

							logger.log('info', '[rpc] [auth] Creating user "%s"', user.user);
							user.beforeCreate().save().success(function(user) {
								logger.log('info', '[rpc] [auth] All good, user created.');
								alert = { title: 'Welcome!', message: 'Registration successful. You can login now.' };
								res({ alert: alert, success: true });
								hs.linkNewUser(user, function(err) {
									if (err) {
										return logger.log('error', '[rpc] [auth] Error linking user to high scores: ' + err);
									}
									logger.log('info', '[rpc] [auth] User successfully linked to high scores.');
								});

							}).error(function(err) {
								if (_.isObject(err)) {
									logger.log('warning', '[rpc] [auth] There were validation errors: %j', err, {});
									return res({ errors: err, success: false });
								}
								alert = { title: 'Ooops. Looks like a user creation problem.', message: err };
								logger.log('error', '[rpc] [auth] Error creating user: %s', err);
								logger.log('error', '[rpc] [auth] Validations: %js', user.errors, {});
								res({ alert : alert, success: false });
							});
						} else {
							res({ errors: { user: 'This username is already taken.' }, success: false });
						}
					});
				});

			} else {
				alert = { title: 'Mind reading problem.', message: 'You must provide both username and password.', btn: 'OK, I\'ll try.' };
				res({ alert: alert, success: false });
			}
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
