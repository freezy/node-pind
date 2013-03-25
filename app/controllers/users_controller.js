var util = require('util');
var settings = require('./config/settings-mine');

load('application');

action('login', function (context) {

	this.title = 'Login';

	// check if data was posted.
	if (context.req.method == 'POST') {
		console.log('Checking login credentials.');
		if (req.body.user) {

			// authenticate user
			User.authenticate(req.body.user, req.body.pass, function(err, success) {
				if (err) {
					redirect(pathTo.login);

				// credentials check out
				} else if (success) {
					// set "remember me" cookie.
					if (req.body.rememberme) {
						context.res.cookie('authtoken', user.authtoken, { signed: true });
						context.res.cookie('user', user.user, { signed: true });
					} else {
						context.res.clearCookie('authtoken');
						context.res.clearCookie('user');
					}
					context.req.session.user = user;
					redirect(context.req.session.redirectUrl ? context.req.session.redirectUrl : pathTo.root);
					return;

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
		if (context.req.session.logout) {
			req.session.destroy(function(err) {
				if (err) {
					console.log('Error while destroying session: ' + err);
				}
				this.alert = { title: 'Bye-bye!', message: 'You have been successfully logged out.' };
				context.res.clearCookie('authtoken');
				context.res.clearCookie('user');
				render();
			});
			return;
		}

		// check for auto-login
		if (context.req.signedCookies.user && context.req.signedCookies.authtoken) {
			console.log('Autologin: Checking user "' + context.req.signedCookies.user + '".');
			User.findOne({ where: { user: context.req.signedCookies.user }}, function(err, user) {
				if (!err && user && user.authtoken == context.req.signedCookies.authtoken) {
					console.log('Autologin: User "' + user.user + '" had a valid auth token.');
					context.req.session.user = user;
					redirect(context.req.session.redirectUrl ? context.req.session.redirectUrl : pathTo.root);
				} else {
					console.log('Autologin: User "' + context.req.signedCookies.user + '" had an invalid auth token, resetting.');
					context.res.clearCookie('authtoken');
					context.res.clearCookie('user');
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
			User.create({
				user: req.body.user,
				pass: req.body.pass
			}, function(err, user) {
				if (err) {
					if (user) {
						this.validationErrors = user.errors;
					} else {
						this.alert = { title: 'Ooops. Looks like a user creation problem.', message: err };
					}
					console.log('alert: %s', err);
					console.log('validations: %j', user.errors);
					render({user : req.body});
				} else {
					console.log('all good, user created.');
					this.validationErrors = null;
					this.alert = { title: 'Welcome!', message: 'Registration successful. You can login now.' };
					render('login');
				}
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
action('logout', function(context) {
	context.req.session.logout = true;
	redirect(pathTo.login);
});