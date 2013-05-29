var ih = require('insanehash').crypto;

module.exports = function(sequelize, DataTypes) {

	function hash(str) {
		return ih.blake32(str);
	}
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
	}

	function hashPassword(pass) {
		var salt = randomKey();
		return salt + hash(pass + salt);
	}

	var User = sequelize.define('users', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true
		},
		user: {
			type: DataTypes.STRING,
			unique: true,
			allowNull: false,
			validate: {
				l: function(value) {
					var len = value.trim().length;
					if (len < 2 || len > 3 ) {
						throw new Error('User name must be either two or tree characters.');
					}
				}
			}
		},
		pass: {
			type: DataTypes.STRING,
			allowNull: false,
			validate: {
				l: function(value) {
					if (value.trim().length < 6) {
						throw new Error('Password must be at least six characters.');
					}
				}
			}
		},
		authtoken: DataTypes.STRING,
		name: DataTypes.STRING,
		email: DataTypes.STRING,
		admin: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		credits: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		settings: DataTypes.TEXT
	},
	{
		classMethods: {

			authenticate: function(username, password, callback) {

				User.find({ where: { user: username } }).success(function(row) {
					if (!row) {
						console.log('User "' + username  + '" not found.');
						callback();
					} else {
						if (row.verifyPassword(password, row.pass)) {
							callback(null, row);
						} else {
							callback();
						}
					}
				}).error(function(err) {
					return callback(err);
				});
			},

			autologin: function(user, authtoken, callback) {
				console.log('Autologin: Checking user "' + user + '".');
				User.find({ where: { user: user } }).success(function(user) {
					if (user && user.authtoken == authtoken) {
						console.log('Autologin: User "' + user.user + '" had a valid auth token.');
						callback(null, user);
					} else {
						console.log('Autologin: User "' + user + '" had an invalid auth token, resetting.');
						callback('Invalid token.')
					}
				}).error(function(err) {
					return callback(err);
				});
			},

			verifyPassword: function(plainPass, hashedPass) {
				var salt = hashedPass.substr(0, 10);
				var validHash = salt + hash(plainPass + salt);
				return hashedPass === validHash;
			}
		},

		instanceMethods: {

			verifyPassword: function(plainPass) {
				var salt = this.pass.substr(0, 10);
				var validHash = salt + hash(plainPass + salt);
				return this.pass === validHash;
			},


			// hooks
			beforeCreate: function() {
				this.pass = hashPassword(this.pass);
				this.authtoken = randomKey(32);
				return this;
			}
		},

		timestamps: true
	});
	return User;
};

