var util = require('util');

load('application');

action('login', function (context) {

	// check if data was posted.
	if (context.req.method == 'POST') {
		console.log('got a POST.')

		User.findOne({where: {user: req.body.user}}, function(err, user) {
			if (err) {
				console.log("Error retrieving user: " + err);
				redirect(pathTo.login);
			} else {
				if (User.verifyPassword(body.pass, user.pass)) {
					context.req.session.user = user;
					redirect(context.req.session.redirectUrl ? context.req.session.redirectUrl : pathTo.root);
				} else {
					redirect(pathTo.login);
				}
			}
		});
	}
	this.title = 'Login';
	render();
});

action('signup', function () {

	this.title = 'Signup';

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
				console.log('error: %s', err);
				console.log('validations: %j', user.errors);
			} else {
				console.log('all good, user created.');
				this.errors = null;
			}
			console.log('rendering with user = %j', req.body);
			render({user : req.body});
		});

	} else {
		this.errors = null;
		render();
	}

});
