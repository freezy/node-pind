var ih = require('insanehash').crypto;

module.exports = function (compound, User) {

	/*
	 * VALIDATIONS
	 */
	User.validatesLengthOf('user', { is: 3, message: { is: 'Username must be three characters.' }, allowBlank: false });
	User.validatesUniquenessOf('user', { message: 'This username is already taken.' });
	User.validatesLengthOf('pass', { min: 6, message: { min: 'Password must be at least six characters.' }});

	/*
	 * HOOKS
	 */
	User.afterValidation = function(next) {
		if (this.pass) {
			this.pass = saltAndHash(this.pass);
			this.authtoken = randomKey(32);
		}
		next();
	};

	User.beforeCreate = function(next) {

		this.created = new Date();
		this.updated = new Date();
		this.credits = 0;

		var that = this;
		User.count(function(err, num) {
			that.admin = !err && num == 0;
			next();
		})
	};

	User.beforeUpdate = function(next) {
		that.updated = new Date();
	}

	/*
	 * SPECIAL FUNCTIONS
	 */
	User.verifyPassword = function(plainPass, hashedPass) {
		var salt = hashedPass.substr(0, 10);
		var validHash = salt + hash(plainPass + salt);
		return hashedPass === validHash;
	};
};

function hash(str) {
	return ih.blake32(str);
};
function randomKey(n) {
	if (!n) {
		n = 10;
	}
	var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
	var key = '';
	for (var i = 0; i < n; i++) {
		var p = Math.floor(Math.random() * set.length);
		key += set[p];
	}
	return key;
};
function saltAndHash(pass, callback) {
	var salt = randomKey();
	return salt + hash(pass + salt);
};
