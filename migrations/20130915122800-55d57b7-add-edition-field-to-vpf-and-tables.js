var async = require('async');
var schema = require('./../server/database/schema');

module.exports = {

	up: function(migration, DataTypes, done) {

		async.series([
			function(next) {
				migration.addColumn('tables', 'edition', DataTypes.ENUM('standard', 'nightmod')).complete(next);
			},
			function(next) {
				migration.addColumn('vpf_files', 'edition', DataTypes.ENUM('standard', 'nightmod')).complete(next);
			},
			function(next) {
				schema.Table.all().success(function(rows) {
					async.eachSeries(rows, function(row, next) {
						var edition = 'standard';
						if (row.name.match(/[^a-z]night[^a-z]*mod|[^a-z]dark[^a-z]*mod|[^a-z0-9]nm\s*$/i)) {
							edition = 'nightmod';
						}
						row.updateAttributes({ edition: edition }).success(function() {
							next();
						});
					}, next);
				});
			},
			function(next) {
				schema.VpfFile.all().success(function(rows) {
					async.eachSeries(rows, function(row, next) {
						var edition = 'standard';
						if (row.title.match(/[^a-z]night[^a-z]*mod|[^a-z]dark[^a-z]*mod|[^a-z0-9]nm\s*$/i)) {
							edition = 'nightmod';
						}
						row.updateAttributes({ edition: edition }).success(function() {
							next();
						});
					}, next);
				});
			}

		], done);
	},

	down: function(migration, DataTypes, done) {
		async.series([
			function(next) {
				migration.removeColumn('tables', 'edition').complete(next);
			},
			function(next) {
				migration.removeColumn('vpf_files', 'edition').complete(next);
			}
		], done);
	}
};