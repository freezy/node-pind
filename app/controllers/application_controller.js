var util = require('util');
var c = compound.utils.stylize.$;
var log = compound.utils.debug;


publish('requireUser', requireUser);

before('protect from forgery', function () {
  protectFromForgery('4a63d1756c1801a833cdd50ece1d192ecba3fafa');
});


function requireUser() {
	if (req.session.user) {
		next();
	} else {
		log(c('[auth] No valid session, redirecting to login page.').grey);
		req.session.redirectUrl = req.originalUrl
		redirect(path_to.login);
	}
}

before(requireUser, { except: [ 'login', 'loginPost', 'signup', 'signupPost' ] });
