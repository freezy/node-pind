var async = require('async');
var log = require('winston');

module.exports = function(compound, Table) {

	/*
	 * VALIDATIONS
	 */


	/*
	 * HOOKS
	 */
	Table.beforeCreate = function(next) {

		this.created = new Date();
		this.updated = new Date();
		this.credits = 0;
		var that = this;
		generateKey(3, function(err, key) {
			if (err) {
				next(err);
			} else {
				that.key = key;
				next();
			}
		});
	};


	/*
	 * SPECIAL FUNCTIONS
	 */
	Table.updateAll = function(tables, now, callback) {

		var updateOrCreate = function(table, callback) {
			if (!table.hpid || !table.platform) {
				callback('Provided object must contain at least name and platform.');
			}
			Table.findOne({ where: { hpid: table.hpid, platform: table.platform }}, function(err, row) {
				if (row) {
					row.name = table.name;
					row.manufacturer = table.manufacturer;
					row.year = table.year;
					row.filename = table.filename;
					row.type = table.type;
					row.updated = now;

					row.save(callback);

				} else {
					Table.create(table);
				}
			});
		};

		async.eachSeries(tables, updateOrCreate, function(err) {
			log.debug("[table] Database is now updated, deactivating dirty records.");

			//db.prepare('UPDATE tables SET enabled = (?) WHERE updated < (?);').run([ false, now ], function(err) {
			//	callback(err, games);
			//});
		});
	}

	Table.search = function(params, callback) {
		if (Object.keys(params).length == 0) {
			callback('At least one search parameter must be supplied.');
			return;
		}
		var validParams = [ 'name', 'year', 'type' ];
		var paramNames = Object.keys(params);
		var paramValues = [];
		var where = {};
		var query = 'SELECT * FROM tables WHERE ';
		for (var i = 0; i < paramNames.length; i++) {
			var name = paramNames[i];
			var value = params[name];
			if (validParams.indexOf(name) >= 0) {
				where[name] =
				query += name + ' = (?) AND ';
				paramValues.push(value);
			}
		}
		if (paramValues.length == 0) {
			callback('Must at least provide one valid search parameter. Valid parameters are: [' + validParams + '].');
			return;
		}
		query = query.substr(0, query.length - 5) + ';'
		db.all(query, paramValues, function(err, rows) {
			callback(err, rows, params);
		});
	};


	/*
	 * HELPER FUNCTIONS
	 */
	function generateKey(length, callback, numtry) {
		if (!numtry) {
			numtry = 0;
		}
		var key = '';
		var range = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

		for (var i = 0; i < length; i++) {
			key += range.charAt(Math.floor(Math.random() * range.length));
		}
		Table.count({ key: key }, function(err, num) {
			if (err) {
				callback(err);
				return;
			}
			if (num == 0) {
				callback(null, key);
			} else {
				if (numtry > 9) {
					generateKey(length + 1, callback, 0);
				} else {
					generateKey(length, callback, numtry + 1);
				}
			}
		});
	};
};

