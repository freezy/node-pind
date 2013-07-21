var schema = require('../database/schema');

exports.actions = function(req, res, ss) {
	req.use('session');

	return {
		authenticate: function(username, pass) {

			console.log('Checking login credentials.');
			if (username) {

				// authenticate user
				schema.User.authenticate(username, pass, function(err, user) {
					if (err) {
						ss.log("Error authenticating: " + err);
						res(false);

					// credentials check out
					} else if (user) {

						// set "remember me" cookie.
/*						if (req.body.rememberme) {
							res.cookie('authtoken', user.authtoken, { signed: true });
							res.cookie('user', user.user, { signed: true });
						} else {
							res.clearCookie('authtoken');
							res.clearCookie('user');
						}*/
						req.session.setUserId(user.user);
						req.session.user = user;
						res(true);

					// access denied
					} else {
						ss.log("Invalid credentials for " + username + ".");
						res(false);
					}
				});
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
