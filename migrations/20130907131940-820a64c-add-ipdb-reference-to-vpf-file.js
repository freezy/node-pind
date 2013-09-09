var async = require('async');

module.exports = {

	up: function(migration, DataTypes, done) {
		migration.addColumn('vpf_files', 'ipdb_id', DataTypes.INTEGER).complete(done);
	},

	down: function(migration, DataTypes, done) {
		migration.removeColumn('vpf_files', 'ipdb_id', DataTypes.INTEGER).complete(done);
	}
};