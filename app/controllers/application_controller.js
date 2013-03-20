var util = require('util');

before('protect from forgery', function () {
  protectFromForgery('4a63d1756c1801a833cdd50ece1d192ecba3fafa');
});

function requireLogin() {
	console.log('requireLogin context: %s', util.inspect(req.body));
	User.sayHello();

	// check session inside `req.session`
	// or cookie, or post with login and password, or something else to authenticate your user
	// for example this logic defined in User.authenticate
	if (req.session.user_id) {
		User.load(req.session.user_id, function (user) {
			req.user = user;
			next(); // IMPORTANT: call next filter (or action) in chain
		});
	} else {
		if (req.body.user && req.body.pass) {
			User.authenticate(req.body, function (user) {
				req.user = user;
				next(); // IMPORTANT: call next filter (or action) in chain
			})
		} else {
			req.session.redirectUrl = req.originalUrl
			redirect(path_to.login);
		}
	}
}


before(requireLogin, { except: [ 'login', 'loginPost', 'signup', 'signupPost' ] });
