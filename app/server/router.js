var AM = require('./modules/account-manager');
var EM = require('./modules/email-dispatcher');
var API = require('./modules/api');
var HP = require('./modules/hyperpin');

module.exports = function(app) {

	// main login page
	app.get('/', function(req, res) {
		// check if the user's credentials are saved in a cookie //
		if (req.cookies.user == undefined || req.cookies.pass == undefined) {
			res.render('login2', { title : 'Hello - Please Login To Your Account' });
		} else {
			// attempt automatic login //
			AM.autoLogin(req.cookies.user, req.cookies.pass, function(o) {
				if (o != null) {
					req.session.user = o;
					res.redirect('/home');
				} else {
					res.render('login2', { title : 'Hello - Please login to your account' });
				}
			});
		}
	});

	app.post('/', function(req, res) {
		AM.manualLogin(req.param('user'), req.param('pass'), function(e, o) {
			if (!o) {
				res.send(e, 400);
			} else {
				req.session.user = o;
				if (req.param('remember-me') == 'true') {
					res.cookie('user', o.user, { maxAge : 900000 });
					res.cookie('pass', o.pass, { maxAge : 900000 });
				}
				res.send(o, 200);
			}
		});
	});

	// logged-in user homepage
	app.get('/home', function(req, res) {
		if (req.session.user == null) {
			// if user is not logged-in redirect back to login page //
			res.redirect('/');
		} else {
			res.render('home', {
				title : 'Control Panel',
				udata : req.session.user
			});
		}
	});

	app.post('/home', function(req, res) {
		if (req.param('user') != undefined) {
			AM.updateAccount({
				user : req.param('user'),
				name : req.param('name'),
				email : req.param('email'),
				pass : req.param('pass')
			}, function(e, o) {
				if (e) {
					res.send('error-updating-account', 400);
				} else {
					req.session.user = o;
					// update the user's login cookies if they exists //
					if (req.cookies.user != undefined && req.cookies.pass != undefined) {
						res.cookie('user', o.user, { maxAge : 900000 });
						res.cookie('pass', o.pass, { maxAge : 900000 });
					}
					res.send('ok', 200);
				}
			});
		} else if (req.param('logout') == 'true') {
			res.clearCookie('user');
			res.clearCookie('pass');
			req.session.destroy(function(e) {
				res.send('ok', 200);
			});
		}
	});

	// creating new accounts
	app.get('/signup', function(req, res) {
		res.render('signup', {  title : 'Signup' });
	});

	app.post('/signup', function(req, res) {
		AM.addNewAccount({
			name : req.param('name'),
			email : req.param('email'),
			user : req.param('user'),
			pass : req.param('pass')
		}, function(e) {
			if (e) {
				res.send(e, 400);
			} else {
				res.send('ok', 200);
			}
		});
	});

	// password reset
	app.post('/lost-password', function(req, res) {
		// look up the user's account via their email //
		AM.getAccountByEmail(req.param('email'), function(o) {
			if (o) {
				res.send('ok', 200);
				EM.dispatchResetPasswordLink(o, function(e, m) {
					// this callback takes a moment to return //
					// should add an ajax loader to give user feedback //
					if (!e) {
						//	res.send('ok', 200);
					} else {
						res.send('email-server-error', 400);
						for (k in e) console.log('error : ', k, e[k]);
					}
				});
			} else {
				res.send('email-not-found', 400);
			}
		});
	});

	app.get('/reset-password', function(req, res) {
		var user = req.query["u"];
		var passH = req.query["p"];
		AM.validateResetLink(user, passH, function(e) {
			if (e != 'ok') {
				res.redirect('/');
			} else {
				// save the user's email in a session instead of sending to the client //
				req.session.reset = { user : user, passHash : passH };
				res.render('reset', { title : 'Reset Password' });
			}
		})
	});

	app.post('/reset-password', function(req, res) {
		var nPass = req.param('pass');
		// retrieve the username from the session to lookup their account and reset password //
		var user = req.session.reset.user;
		// destory the session immediately after retrieving the stored email //
		req.session.destroy();
		AM.updatePassword(user, nPass, function(o) {
			if (o) {
				res.send('ok', 200);
			} else {
				res.send('unable to update password', 400);
			}
		})
	});

	// view & delete accounts //
	app.get('/print', function(req, res) {
		AM.getAllRecords(function(e, accounts) {
			res.render('print', { title : 'Account List', accts : accounts });
		})
	});

	app.post('/delete', function(req, res) {
		AM.deleteAccount(req.body.id, function(e, obj) {
			if (!e) {
				res.clearCookie('user');
				res.clearCookie('pass');
				req.session.destroy(function(e) {
					res.send('ok', 200);
				});
			} else {
				res.send('record not found', 400);
			}
		});
	});

	app.get('/reset', function(req, res) {
		AM.delAllRecords(function() {
			res.redirect('/print');
		});
	});

	app.post('/api', API.checkCredentials, function(req, res) {
		API.handle(req, res);
	});

	app.get('/asset/hp/table/:name.png', function(req, res) {
		HP.asset(res, 'Table Images/' + req.params.name + '.png');
	});

	app.get('*', function(req, res) {
		res.render('404', { title : 'Page Not Found'});
	});

};