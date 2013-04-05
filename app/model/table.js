var async = require('async');
var util = require('util');
var log = require('winston');

module.exports = function(sequelize, DataTypes) {

	var Table = sequelize.define('tables', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true
		},
		key: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true
		},
		name: DataTypes.STRING,
		manufacturer: DataTypes.STRING,
		year: DataTypes.INTEGER,
		type: DataTypes.STRING,
		platform: DataTypes.STRING,
		filename: DataTypes.STRING,
		hpid: DataTypes.STRING,
		rom: DataTypes.STRING,
		ipdb_no: DataTypes.STRING,
		ipdb_mfg: DataTypes.STRING,
		ipdb_rank: DataTypes.STRING,
		rating: DataTypes.FLOAT,
		modelno: DataTypes.STRING,
		short: DataTypes.STRING,
		table_file: DataTypes.BOOLEAN,
		rom_file: DataTypes.BOOLEAN,
		media_table: DataTypes.BOOLEAN,
		media_backglass: DataTypes.BOOLEAN,
		media_wheel: DataTypes.BOOLEAN,
		media_video: DataTypes.BOOLEAN,
		enabled: DataTypes.BOOLEAN
	},
	{
		classMethods: {

			updateAll: function(tables, now, callback) {

				var that = this;
				var updateOrCreate = function(table, callback) {
					if (!table.hpid || !table.platform) {
						callback('Provided object must contain at least name and platform.');
					}
					Table.find({ where: { hpid: table.hpid, platform: table.platform }}).success(function(row) {
						if (row) {

							row.updateAttributes(table).success(function(r) {
								callback(null, r);
							}).error(callback);

						} else {
							that.generateKey(3, function(err, key) {
								if (err) {
									callback(err);
									return;
								}
								table.key = key;
								Table.create(table).success(function(r) {
									callback(null, r);
								}).error(function(err){
									callback(err);
								});
							});
						}
					}).error(callback);
				};

				async.eachSeries(tables, updateOrCreate, function(err) {
					log.debug("[table] Database is now updated, deactivating dirty records.");
					callback(err, tables);

					//db.prepare('UPDATE tables SET enabled = (?) WHERE updated < (?);').run([ false, now ], function(err) {
					//	callback(err, games);
					//});
				});
			},

			generateKey: function(length, callback, numtry) {
				if (!numtry) {
					numtry = 0;
				}
				var key = '';
				var range = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

				for (var i = 0; i < length; i++) {
					key += range.charAt(Math.floor(Math.random() * range.length));
				}
				Table.count({ where: { key: key }}).success(function(num) {
					if (num == 0) {
						callback(null, key);
					} else {
						if (numtry > 9) {
							this.generateKey(length + 1, callback, 0);
						} else {
							this.generateKey(length, callback, numtry + 1);
						}
					}
				}).error(callback);
			}
		},

		instanceMethods: {

			// hooks
			beforeCreate: function() {
				this.pass = hashPassword(this.pass);
				this.authtoken = randomKey(32);
			}
		},

		timestamps: true
	});
	return Table;
}

