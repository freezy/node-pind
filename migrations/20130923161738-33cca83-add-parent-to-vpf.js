var async = require('async');

module.exports = {

	up: function(migration, DataTypes, done) {
		migration.addColumn('vpf_files', 'parent_fileId', DataTypes.INTEGER).complete(done);
	},

	down: function(migration, DataTypes, done) {
		migration.removeColumn('vpf_files', 'parent_fileId', DataTypes.INTEGER).complete(done);
	}
};