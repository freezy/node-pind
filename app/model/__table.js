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

		this.added = new Date();
		this.updated = new Date();
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

	/**
	 * Update or adds a given array of tables.
	 *
	 * @param tables Tables to update or add
	 * @param now Timestamp
	 * @param callback
	 */
	Table.updateAll = function(tables, now, callback) {

		var updateOrCreate = function(table, callback) {
			if (!table.hpid || !table.platform) {
				callback('Provided object must contain at least name and platform.');
			}
			Table.findOne({ where: { hpid: table.hpid, platform: table.platform }}, function(err, row) {
				if (row) {
/*					row.name = table.name;
					row.manufacturer = table.manufacturer;
					row.year = table.year;
					row.filename = table.filename;
					row.type = table.type;
					*/

					table.updated = now;
					row.updateAttributes(table, callback);

					//row.save(callback);

				} else {
					Table.create(table, callback);
				}
			});
		};

		async.eachSeries(tables, updateOrCreate, function(err) {
			log.debug("[table] Database is now updated, deactivating dirty records.");
			callback(err, tables);

			//db.prepare('UPDATE tables SET enabled = (?) WHERE updated < (?);').run([ false, now ], function(err) {
			//	callback(err, games);
			//});
		});
	}

	Table.updateOne = function(table, callback) {
		if (!table.id) {
			callback('ID of table must be set.');
		}

		log.debug('[table] Updating game: ' + table.name);

		Table.find(table.id, function(err, row) {
			if (!row) {
				callback('No game found with ID "' + table.id + '".');
				return;
			}

			// check if dirty
			var attribs = [ 'name', 'ipdb_no', 'ipdb_mfg', 'ipdb_rank', 'rating', 'short', 'modelno' ];
			var dirty = false;
			var values = {}
			for (var i = 0; i < attribs.length; i++) {
				var attr = attribs[i];
				if (table[attr] != null && row[attr] != table[attr]) {
					values[attr] = table[attr];
					dirty = true;
				}
			}

			// if nothing additional provided, return.
			if (!dirty) {
				log.info('[table] Game "' + row.name + '" (' + row.platform + ') is clean, not updating.');
				callback(null, row);
				return;
			}
			console.log('Updating: %j', values);
			row.updateAttributes(values, function(err) {
				callback(err, row);
			});
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

