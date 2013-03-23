var util = require('util');
var settings = require('./config/settings-mine');

load('application');

action('login', function (context) {

	this.title = 'Login';

	// check if data was posted.
	if (context.req.method == 'POST') {
		console.log('Checking login credentials.');
		if (req.body.user) {
			User.findOne({where: {user: req.body.user}}, function(err, user) {
				if (err) {
					console.log("Error retrieving user: " + err);
					redirect(pathTo.login);
				} else {
					var wrongCredentials = { title: 'Sorry!', message: 'Invalid credentials.' };
					if (user == null) {
						console.log('User "' + req.body.user  + '" not found.');
						this.alert = wrongCredentials;
					} else {
						if (User.verifyPassword(body.pass, user.pass)) {
							context.res.cookie('auth', user.authtoken);
							context.req.session.cookie.maxAge = settings.pind.sessionTimeout;
							context.req.session.user = user;
							redirect(context.req.session.redirectUrl ? context.req.session.redirectUrl : pathTo.root);
						} else {
							console.log('Wrong password.');
							this.alert = wrongCredentials;
						}
					}
				}
				render();
			});
		} else {
			console.log('No username provided.');
			this.alert = { title: 'Mind reading problem.', message: 'A username would be useful.' };
			render();
		}
	} else {
		this.alert = null;
		render();
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


action('logout', function (context) {
	this.title = 'Logout'
	if (req.session.user) {
		delete req.session.user;
	}
	this.alert = { title: 'Bye-bye!', message: 'You have been successfully logged out.' };
	render('login');
});