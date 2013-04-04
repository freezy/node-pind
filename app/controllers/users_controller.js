var util = require('util');
var settings = require('./config/settings-mine');
var schema = require('./app/model/schema');

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

action('signup', function () {

	this.title = 'Signup';

	// check if data was posted.
	if (req.method == 'POST') {
		if (req.body.user && req.body.pass) {
			var now = new Date().getTime();
			var that = this;
			schema.User.count().success(function(num) {
				schema.User.find({ where: { user: req.body.user }}).success(function(user) {
					if (!user) {
						user = schema.User.build({
							user: req.body.user,
							pass: req.body.pass,
							admin: num == 0
						});
						that.validationErrors = user.validate();

						if (!that.validationErrors) {
							schema.User.c(user).success(function(user) {
								console.log('all good, user created.');
								that.validationErrors = null;
								that.alert = { title: 'Welcome!', message: 'Registration successful. You can login now.' };
								render('login');

							}).error(function(err) {
								that.alert = { title: 'Ooops. Looks like a user creation problem.', message: err };
								console.log('alert: %s', err);
								console.log('validations: %j', user.errors);
								render({user : req.body});
							});
						} else {
							render({user : req.body});
						}
					} else {
						that.validationErrors = { user: 'This username is already taken.' };
						render({user : req.body});
					}
				}).error(function(err) {
					console.log('Error checking unique constraint for user: ' + err);
					that.alert = { title: 'Whoopsie!', message: 'An internal server error occurred. Try again or contact us.' };
					render();
				});

			}).error(function(err) {
				console.log('Error counting users: ' + err);
				that.alert = { title: 'Whoopsie!', message: 'An internal server error occurred. Try again or contact us.' };
				render();
			});

		} else {
			this.alert = { title: 'Mind reading problem.', message: 'You must provide both username and password.' };
			this.validationErrors = null;
			render();
		}
	} else {
		this.alert = null;
		this.validationErrors = null;
		render();
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