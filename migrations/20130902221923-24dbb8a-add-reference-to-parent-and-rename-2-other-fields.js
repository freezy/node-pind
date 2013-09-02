var async = require('async');

module.exports = {

	up: function(migration, DataTypes, done) {

		async.series([
			function(next) {
				migration.renameColumn('tables', 'reference', 'ref_src').complete(next);
			},
			function(next) {
				migration.renameColumn('transfers', 'reference', 'ref_src').complete(next);
			},
			function(next) {
				migration.addColumn('transfers', 'ref_parent', DataTypes.INTEGER).complete(next);
			}
		], done);
	},

	down: function(migration, DataTypes, done) {
		async.series([
			function(next) {
				migration.renameColumn('tables', 'ref_src', 'reference').complete(next);
			},
			function(next) {
				migration.renameColumn('transfers', 'ref_src', 'reference').complete(next);
			},
			function(next) {
				migration.removeColumn('transfers', 'ref_parent').complete(next);
			}
		], done);
	}
};