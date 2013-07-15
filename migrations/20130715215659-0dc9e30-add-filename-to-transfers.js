var async = require('async');

module.exports = {

	up: function(migration, DataTypes, done) {
		migration.addColumn('transfers', 'filename', DataTypes.STRING).complete(done);
	},

	down: function(migration, DataTypes, done) {
		migration.removeColumn('transfers', 'filename', DataTypes.STRING).complete(done);
	}
};