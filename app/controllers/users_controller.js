var util = require('util');

load('application');

action('login', function (context) {

	// check if data was posted.
	if (context.req.method == 'POST') {
		console.log('got a POST.')

		// do auth stuff
		if (false) {
			redirect(context.req.session.redirectUrl);
		} else {

		}

	} else{
		console.log('got a GET.')
	}
	this.title = 'Login';
	render();
});

action('signup', function () {

	// check if data was posted.
	if (context.req.method == 'POST') {
		var now = new Date().getTime();
		User.create({
			user: req.body.user,
			pass: req.body.pass,
			created: now,
			updated: now
		}, function(err, user) {
			if (err) {
				if (user) {
					this.errors = user.errors;
				} else {
					this.errors = { error: err };
				}
				console.log('err: %s', err);
				console.log('user: %j', user.errors);
			} else {
				this.errors = null;
			}
		});
	}

	this.title = 'Signup';
	render();
});
