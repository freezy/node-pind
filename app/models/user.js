module.exports = function (compound, User) {

	User.validatesLengthOf('user', { is: 3, message: { is: 'Username must be three characters.' }});
	User.validatesLengthOf('pass', { min: 6, message: { min: 'Password must be at least six characters.' }});

	User.afterValidation = function(next) {
		if (this.pass) {
			this.pass += ' (hashed)';
		}
	}
};