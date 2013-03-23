var util = require('util');

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
				pass: req.body.pass,
				created: now,
				updated: now
			}, function(err, user) {
				if (err) {
					if (user) {
						this.validationErrors = user.errors;
					} else {
						this.alert = { title: 'Ooops. Looks like a user creation problem.', message: err };
					}
					console.log('alert: %s', err);
					console.log('validations: %j', user.errors);
				} else {
					console.log('all good, user created.');
					this.alert = null;
					this.validationErrors = null;
				}
				console.log('rendering with user = %j', req.body);
				render({user : req.body});
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
