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

action('signup', function () {

	this.title = 'Signup';
	this.hasValidationErrors = false;

	// check if data was posted.
	if (req.method == 'POST') {
		if (req.body.user && req.body.pass) {
			console.log('[user controller] Registering user...');
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
						delete that.validationErrors.fct;
						that.hasValidationErrors = !_.isEmpty(that.validationErrors);

						if (!that.hasValidationErrors) {
							console.error('[user controller] Creating user "%s"', user.user);
							user.beforeCreate().save().success(function(user) {
								console.log('[user controller] All good, user created.');
								that.validationErrors = {};
								that.alert = { title: 'Welcome!', message: 'Registration successful. You can login now.' };
								render('login');
								hs.linkNewUser(user, function(err) {
									if (err) {
										return console.error('[user controller] Error linking user to high scores: ' + err);
									}
									console.log('[user controller] User successfully linked to high scores.');
								});

							}).error(function(err) {
								that.alert = { title: 'Ooops. Looks like a user creation problem.', message: err };
								console.error('[user controller] alert: %s', err);
								console.error('[user controller] validations: %j', user.errors);
								render({user : req.body});
							}).done(function() {
								console.log('duh.');
							});
						} else {
							console.error('[user controller] There were validation errors: %j', that.validationErrors);
							render({user : req.body});
						}
					} else {
						that.hasValidationErrors = true;
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
			this.validationErrors = {};
			render();
		}
	} else {
		this.alert = null;
		this.validationErrors = {};
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