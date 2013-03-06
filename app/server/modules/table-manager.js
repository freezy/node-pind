var sqlite3 = require('sqlite3').verbose();
var async = require('async');

var dbName = 'pind';
var db = new sqlite3.Database(dbName + '.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, function(e) {
	if (e) {
		console.log(e);
	} else {
		console.log('Connected to sqlite :: ' + dbName + '.db');
		db.serialize(function() {
//			db.run('DROP TABLE IF EXISTS tables;');
			db.run('CREATE TABLE IF NOT EXISTS tables (' +
				'id VARCHAR PRIMARY KEY NOT NULL UNIQUE, ' +
				'name VARCHAR, ' +
				'manufacturer VARCHAR, ' +
				'year INTEGER, ' +
				'type VARCHAR(2), ' +
				'filename VARCHAR, ' +
				'hpid VARCHAR, ' +
				'ipdbno INTEGER, ' +
				'ipdbmfg INTEGER, ' +
				'ipdbrank INTEGER, ' +
				'rating DOUBLE, ' +
				'short VARCHAR, ' +
				'added DATETIME, ' +
				'updated DATETIME, ' +
				'enabled BOOLEAN ' +
				');');
		});
	}
});


exports.find = function(params, callback) {
	if (Object.keys(params).length == 0) {
		callback('At least one search parameter must be supplied.');
		return;
	}
	var validParams = [ 'name', 'year', 'type' ];
	var paramNames = Object.keys(params);
	var paramValues = [];
	var query = 'SELECT * FROM tables WHERE ';
	for (var i = 0; i < paramNames.length; i++) {
		var name = paramNames[i];
		var value = params[name];
		if (validParams.indexOf(name) >= 0) {
			query += name + ' = (?) AND ';
			paramValues.push(value);
		}
	}
	if (paramValues.length == 0) {
		callback('Must at least provide one valid search parameter. Valid parameters are: [' + validParams + '].');
		return;
	}
	query = query.substr(0, query.length - 5) + ';'
	db.get(query, paramValues, function(err, row) {
		callback(err, row, params);
	});
};

exports.updateTables = function(games, callback) {

	var now = new Date().getTime();
	var updateTable = function(game, callback) {

		db.get('SELECT * FROM tables WHERE hpid = (?)', [ game.hpid ], function(err, row) {
			if (row) {
				game.id = row.id;
				db.prepare('UPDATE tables SET name = (?), manufacturer = (?), year = (?), filename = (?), type = (?), updated = (?), enabled = (?) WHERE id = (?);')
					.run([ game.name, game.manufacturer, game.year, game.filename, game.type, now, true, row.id ], callback);
			} else {
				generateKey(db, 'tables', 3, function(err, key) {
					game.id = key;
					if (err) {
						callback(err);
						return;
					}
					db.prepare('INSERT INTO tables (id, hpid, name, manufacturer, year, filename, type, added, updated, enabled) VALUES ((?), (?), (?), (?), (?), (?), (?), (?), (?), (?));')
						.run([ key, game.hpid, game.name, game.manufacturer, game.year, game.filename, game.type, now, now, true  ], callback);
				});
			}
		});
	};

	async.eachSeries(games, updateTable, function(err) {
		console.log("db updated, deactivating dirty records.");
		db.prepare('UPDATE tables SET enabled = (?) WHERE updated < (?);').run([ false, now ], function(err) {
			callback(err, games);
		});
	});
};

exports.updateTable = function(game, callback) {
	if (!game.id) {
		callback("id must of game must be set.");
	}

	console.log("updating game %j", game);

	db.get('SELECT * FROM tables WHERE id = (?)', [ game.id ], function(err, row) {
		if (!row) {
			callback('No game found with id "' + game.id + '".');
			return;
		}
		var query = 'UPDATE tables SET ';
		var params = [];
		var attribs = [ 'name', 'ipdbno', 'ipdbmfg', 'ipdbrank', 'rating', 'short' ];
		var dirty = false;
		for (var i = 0; i < attribs.length; i++) {
			var attr = attribs[i];
			if (game[attr] != null && row[attr] != game[attr]) {
				query += attr + ' = (?), ';
				params.push(game[attr]);
				dirty = true;
			}
		}

		// if nothing additional provided, return.
		if (!dirty) {
			console.log("table is clean, not updating.");
			callback(null, game);
			return;
		}
		query += 'updated = (?) WHERE id = (?);';
		console.log(query);
		params.push(new Date().getTime());
		params.push(game.id);

		db.prepare(query).run(params, function(err) {
			callback(err, game);
		});
	});
};

var generateKey = function(db, table, length, callback, numtry) {
	if (!numtry) {
		numtry = 0;
	}
	var key = '';
	var range = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

	for (var i = 0; i < length; i++) {
		key += range.charAt(Math.floor(Math.random() * range.length));
	}
	db.get('SELECT count() AS c FROM ' + table + ' WHERE id = (?);', [ key ], function(err, row) {
		if (err) {
			callback(err);
			return;
		}
		if (row.c == 0) {
			callback(null, key);
		} else {
			if (numtry > 9) {
				generateKey(db, table, length + 1, callback, 0);
			} else {
				generateKey(db, table, length, callback, numtry + 1);
			}
		}
	});
};