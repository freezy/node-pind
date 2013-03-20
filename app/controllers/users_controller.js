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
		User.create({
			user: req.body.user,
			pass: req.body.pass,
			created: new Date().getTime(),
			updated: new Date().getTime()
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
