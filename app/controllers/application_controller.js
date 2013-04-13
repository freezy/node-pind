var util = require('util');
var express = require('express');
var schema = require(compound.root + '/app/model/schema');

var c = compound.utils.stylize.$;
var log = compound.utils.debug;

publish('requireUser', requireUser);
publish('requireAdmin', requireAdmin);

before(function () {
	protectFromForgery('4a63d1756c1801a833cdd50ece1d192ecba3fafa');
}, { except: 'api#handle' });

before(requireUser, { except: [ 'login', 'loginPost', 'signup', 'signupPost', 'api' ] });

function requireUser() {
	if (req.session.user) {
		// session objects are only stored as pojo, but need the persisted sequelize object.
		schema.User.find({ id: req.session.user.id }).success(function(user) {
			if (user == null) {
				delete req.session.user;
				redirect(path_to.login);
			} else {
				console.log('user object reloaded from DB.');
				req.session.user = user;
				next();
			}
		}).error(function(err) {
			delete req.session.user;
			redirect(path_to.login);
		});
	} else {

		// api is a special case, can be authenticated via http simple auth.
		if (req.url == pathTo.api) {

			// we allow auto-login here
			if (req.signedCookies.user && req.signedCookies.authtoken) {
				schema.User.autologin(req.signedCookies.user, req.signedCookies.authtoken, function(err, user) {
					if (user) {
						req.session.user = user;
						next();
					} else {
						send(401);
					}
				});

			// otherwise try http simple auth
			} else {
				var auth = express.basicAuth(schema.User.authenticate, 'Authentication Required.');
				auth(req, res, function() {
					console.log('HTTP Basic authentication successful for user ' + req.remoteUser.user + '.');
					req.session.user = req.remoteUser;
					next();
				});
			}
		} else {
			log(c('[auth] No valid session, redirecting to login page.').grey);
			req.session.redirectUrl = req.originalUrl;
			redirect(path_to.login);
		}
	}
}

function requireAdmin() {
	if (req.session.user && req.session.user.admin) {
		next();
	} else {
		redirect(path_to.root);
	}
}