var ih = require('insanehash').crypto;
var logger = require('winston');

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
				l: function(value, next) {
					var len = value.trim().length;
					if (len < 2 || len > 3 ) {
						next('User name must be either two or tree characters.');
					} else {
						next();
					}
				}
			}
		},
		pass: {
			type: DataTypes.STRING,
			allowNull: false,
			validate: {
				l: function(value, next) {
					if (value.trim().length < 6) {
						next('Password must be at least six characters.');
					} else {
						next();
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
				logger.log('info', '[db] [user] Checking unicity for user %j', username);
				User.find({ where: { user: username } }).then(function(row) {
					if (!row) {
						logger.log('info', '[db] [user] User "' + username  + '" not found.');
						callback();
					} else {
						if (row.verifyPassword(password, row.pass)) {
							callback(null, row);
						} else {
							callback();
						}
					}
				}).catch(function(err) {
					return callback(err);
				});
			},

			autologin: function(user, authtoken, callback) {
				logger.log('info', '[db] [user] Autologin: Checking user "' + user + '".');
				User.find({ where: { user: user } }).then(function(user) {
					if (user && user.authtoken == authtoken) {
						logger.log('info', '[db] [user] Autologin: User "' + user.user + '" had a valid auth token.');
						callback(null, user);
					} else {
						logger.log('info', '[db] [user] Autologin: User "' + user + '" had an invalid auth token.');
						callback('Invalid token.')
					}
				}).catch(function(err) {
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

