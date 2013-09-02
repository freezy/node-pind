var async = require('async');

module.exports = {

	up: function(migration, DataTypes, done) {
		migration.addColumn('tables', 'reference', DataTypes.INTEGER).complete(done);
	},

	down: function(migration, DataTypes, done) {
		migration.removeColumn('tables', 'reference', DataTypes.INTEGER).complete(done);
	}
};