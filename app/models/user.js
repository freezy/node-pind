var ih = require('insanehash').crypto;

module.exports = function (compound, User) {

	User.validatesLengthOf('user', { is: 3, message: { is: 'Username must be three characters.' }, allowBlank: false });
	User.validatesUniquenessOf('user', { message: 'This username is already taken.' });
	User.validatesLengthOf('pass', { min: 6, message: { min: 'Password must be at least six characters.' }});

	User.beforeSave = function(next) {
		if (this.pass) {
			this.pass = saltAndHash(this.pass);
		}
		next();
	}

	User.verifyPassword = function(plainPass, hashedPass) {
		var salt = hashedPass.substr(0, 10);
		var validHash = salt + hash(plainPass + salt);
		return hashedPass === validHash;
	}
};

function hash(str) {
	return ih.blake32(str);
};
function generateSalt() {
	var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
	var salt = '';
	for (var i = 0; i < 10; i++) {
		var p = Math.floor(Math.random() * set.length);
		salt += set[p];
	}
	return salt;
};
function saltAndHash(pass, callback) {
	var salt = generateSalt();
	return salt + hash(pass + salt);
};
