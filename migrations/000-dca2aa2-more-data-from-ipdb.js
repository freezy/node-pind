var async = require('async');

module.exports = {

	up: function(migration, DataTypes, done) {
		async.each([
			function(next) {
				migration.addColumn('tables', 'units', DataTypes.INTEGER).complete(next);
			},
			function(next) {
				migration.addColumn('tables', 'theme', DataTypes.STRING).complete(next);
			},
			function(next) {
				migration.addColumn('tables', 'designer', DataTypes.STRING).complete(next);
			},
			function(next) {
				migration.addColumn('tables', 'artist', DataTypes.STRING).complete(next);
			},
			function(next) {
				migration.addColumn('tables', 'features', DataTypes.TEXT).complete(next);
			},
			function(next) {
				migration.addColumn('tables', 'notes', DataTypes.TEXT).complete(next);
			},
			function(next) {
				migration.addColumn('tables', 'toys', DataTypes.TEXT).complete(next);
			},
			function(next) {
				migration.addColumn('tables', 'slogans', DataTypes.TEXT).complete(next);
			}
		], done);
	},

	down: function(migration, DataTypes, done) {
		async.each([
			function(next) {
				migration.removeColumn('tables', 'slogans').complete(next);
			},
			function(next) {
				migration.removeColumn('tables', 'toys').complete(next);
			},
			function(next) {
				migration.removeColumn('tables', 'notes').complete(next);
			},
			function(next) {
				migration.removeColumn('tables', 'features').complete(next);
			},
			function(next) {
				migration.removeColumn('tables', 'artist').complete(next);
			},
			function(next) {
				migration.removeColumn('tables', 'designer').complete(next);
			},
			function(next) {
				migration.removeColumn('tables', 'theme').complete(next);
			},
			function(next) {
				migration.removeColumn('tables', 'units').complete(next);
			}
		], done);
	}
};