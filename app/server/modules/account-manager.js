var moment = require('moment');
var sqlite3 = require('sqlite3').verbose();
var ih = require('insanehash').crypto;

var dbName = 'pind';

var db2 = new sqlite3.Database(dbName + '.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function(e) {

	if (e) {
		console.log(e);
	} else {
		console.log('Connected to sqlite :: ' + dbName + '.db');
		db2.serialize(function() {
//            db2.run('DROP TABLE IF EXISTS users;');
			db2.run('CREATE TABLE IF NOT EXISTS users (user VARCHAR PRIMARY KEY NOT NULL UNIQUE, pass TEXT NOT NULL, name VARCHAR, email VARCHAR, added DATETIME);');
		});
	}
});

var findUserByName = 'SELECT * FROM users WHERE user = (?);';


/* login validation methods */

exports.autoLogin = function(user, pass, callback) {
	db2.get(findUserByName, [ user ], function(e, r) {
		if (r) {
			r.password == pass ? callback(user) : callback(null);
		} else {
			callback(null);
		}
	});
};
exports.manualLogin = function(user, pass, callback) {
	db2.get(findUserByName, [ user ], function(e, r) {
		if (r == null) {
			callback('user-not-found');
		} else {
			validatePassword(pass, r.pass, function(err, res) {
				if (res) {
					callback(null, r);
				} else {
					callback('invalid-password');
				}
			});
		}
	});
};

/* record insertion, update & deletion methods */
exports.addNewAccount = function(newData, callback) {
	db2.get(findUserByName, [ newData.user ], function(e, r) {
		if (r) {
			callback('username-taken');
		} else {
			saltAndHash(newData.pass, function(hash) {
				db2.prepare('INSERT INTO users (user, pass, name, email, added) VALUES (?, ?, ?, ?, ?);')
					.run([ newData.user, hash, newData.name, newData.email, new Date().getTime() ], callback);
			});
		}
	});
};
exports.updateAccount = function(newData, callback) {
	db2.get(findUserByName, [ newData.user ], function(e, r) {
		r.name = newData.name;
		r.email = newData.email;
		if (newData.pass == '') {
			db2.prepare('UPDATE users SET name = (?), email = (?) WHERE user = (?);')
				.run([ r.name, r.email, r.user ], function() {
					callback(null, r);
				});
		} else {
			saltAndHash(newData.pass, function(hash) {
				db2.prepare('UPDATE users SET pass = (?), name = (?), email = (?) WHERE user = (?);')
					.run([ hash, r.name, r.email, r.user ], function() {
						callback(null, r);
					});
			});
		}
	});
};
exports.updatePassword = function(user, newPass, callback) {
	db2.get(findUserByName, [ user ], function(e, r) {
		saltAndHash(newPass, function(hash) {
			db2.prepare('UPDATE users SET hash = (?) WHERE user = (?);')
				.run([ hash, r.user ], callback);
		});
	});
};

/* account lookup methods */
exports.deleteAccount = function(user, callback) {
	db2.prepare('DELETE FROM users WHERE user = (?);').run([ user ], callback);
};
exports.validateResetLink = function(email, passHash, callback) {
	db2.get('SELECT * FROM users WHERE user = (?) AND pass = (?);', [ newData.user, passHash ], function(e, r) {
		callback(o ? 'ok' : null);
	});
};
exports.getAllRecords = function(callback) {
	db2.all('SELECT * FROM users', [], callback);
};
exports.delAllRecords = function(callback) {
	db2.get('SELECT * FROM users;', [ ], callback);
};

/* private encryption & validation methods */
var generateSalt = function() {
	var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
	var salt = '';
	for (var i = 0; i < 10; i++) {
		var p = Math.floor(Math.random() * set.length);
		salt += set[p];
	}
	return salt;
};
var hash = function(str) {
	return ih.blake32(str);
};
var saltAndHash = function(pass, callback) {
	var salt = generateSalt();
	callback(salt + hash(pass + salt));
};
var validatePassword = function(plainPass, hashedPass, callback) {
	var salt = hashedPass.substr(0, 10);
	var validHash = salt + hash(plainPass + salt);
	callback(null, hashedPass === validHash);
};
