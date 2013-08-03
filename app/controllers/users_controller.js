var _ = require('underscore');
var util = require('util');
var settings = require('./config/settings-mine');
var schema = require('./app/model/schema');

var vpm = require('./app/modules/vpinmame')(app);
var hs = require('./app/modules/hiscore')(app);

load('application');

action('login', function() {

	this.title = 'Login';

	// check if data was posted.
	if (req.method == 'POST') {
		console.log('Checking login credentials.');
		if (req.body.user) {

			// authenticate user
			schema.User.authenticate(req.body.user, req.body.pass, function(err, user) {
				if (err) {
					redirect(pathTo.login);

				// credentials check out
				} else if (user) {

					// set "remember me" cookie.
					if (req.body.rememberme) {
						res.cookie('authtoken', user.authtoken, { signed: true });
						res.cookie('user', user.user, { signed: true });
					} else {
						res.clearCookie('authtoken');
						res.clearCookie('user');
					}
					req.session.user = user;
					redirect(req.session.redirectUrl ? req.session.redirectUrl : pathTo.root);

				// access denied
				} else {
					this.alert = { title: 'Sorry!', message: 'Invalid credentials.' };
				}
				render();
			});
		} else {
			console.log('No username provided.');
			this.alert = { title: 'Mind reading problem.', message: 'A username would be useful.' };
			render();
		}

	// nothing was posted.
	} else {

		// check for logout
		if (req.session.logout) {
			req.session.destroy(function(err) {
				if (err) {
					console.log('Error while destroying session: ' + err);
				}
				this.alert = { title: 'Bye-bye!', message: 'You have been successfully logged out.' };
				res.clearCookie('authtoken');
				res.clearCookie('user');
				render();
			});
			return;
		}

		// check for auto-login
		if (req.signedCookies.user && req.signedCookies.authtoken) {
			schema.User.autologin(req.signedCookies.user, req.signedCookies.authtoken, function(err, user) {
				if (user) {
					req.session.user = user;
					redirect(req.session.redirectUrl ? req.session.redirectUrl : pathTo.root);
				} else {
					res.clearCookie('authtoken');
					res.clearCookie('user');
					this.alert = null;
					render();
				}
			});

		// otherwise just display the page.
		} else {
			this.alert = null;
			render();
		}
	}

});


/**
 * Logs the user out. It actually only sets the "logout" session variable
 * and redirects to the login page, which does the actual logout.
 */
action('logout', function() {
	req.session.logout = true;
	redirect(pathTo.login);
});