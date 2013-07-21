var schema = require('../database/schema');

exports.actions = function(req, res, ss) {
	req.use('session');

	return {
		authenticate: function(username, pass, rememberMe, authKey) {

			console.log('Checking login credentials. %s %s %s %s', username, pass, rememberMe, authKey);
			if (username && pass) {

				// authenticate user
				schema.User.authenticate(username, pass, function(err, user) {
					if (err) {
						ss.log("Error authenticating: " + err);
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
						res(result);

					// access denied
					} else {
						ss.log("Invalid credentials for " + username + ".");
						res({ success: false });
					}
				});

			} else if (username && authKey) {
				schema.User.autologin(username, authKey, function(err, user) {
					if (user) {
						req.session.setUserId(user.user);
						req.session.user = user;
						res({ success: true });

					} else {
						ss.log("Invalid auth token for " + username + ".");
						res({ success: false });
					}
				});
			} else {
				res({ success: false });
				ss.log('No credentials nor auth token, ignoring.');
			}

		},
		authenticated: function() {
			console.log('Checking if authenticated (%s)', req.session.userId);
			if (req.session.userId) {
				res(true);
			}
			else {
				res(false);
			}
		},
		logout: function() {
			req.session.setUserId(null);
			res(true);
		}
	};
};
