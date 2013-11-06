var async = require('async');

module.exports = {

	up: function(migration, DataTypes, done) {
		migration.changeColumn('vpf_file', 'description', DataTypes.TEXT).complete(done);
	},

	down: function(migration, DataTypes, done) {
		migration.changeColumn('vpf_file', 'description', DataTypes.VARCHAR).complete(done);
	}
};