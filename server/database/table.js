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
		edition: DataTypes.ENUM('standard', 'nightmod'),
		platform: DataTypes.STRING,
		filename: DataTypes.STRING,
		hpid: DataTypes.STRING,
		hpenabled: DataTypes.BOOLEAN,
		rom: DataTypes.STRING,
		ref_src: DataTypes.INTEGER, // points to vpf_file.id
		ipdb_no: DataTypes.STRING,
		ipdb_mfg: DataTypes.STRING,
		ipdb_rank: DataTypes.INTEGER,
		rating: DataTypes.FLOAT,
		modelno: DataTypes.STRING,
		short: DataTypes.STRING,
		units: DataTypes.INTEGER,
		theme: DataTypes.STRING,
		designer: DataTypes.STRING,
		artist: DataTypes.STRING,
		features: DataTypes.TEXT,
		notes: DataTypes.TEXT,
		toys: DataTypes.TEXT,
		slogans: DataTypes.TEXT,
		table_file: DataTypes.BOOLEAN,
		rom_file: DataTypes.BOOLEAN,
		dmd_rotation: DataTypes.INTEGER,
		controller: DataTypes.STRING,
		media_table: DataTypes.BOOLEAN,
		media_backglass: DataTypes.BOOLEAN,
		media_wheel: DataTypes.BOOLEAN,
		media_video: DataTypes.BOOLEAN,
		enabled: DataTypes.BOOLEAN
	},
	{
		classMethods: {

			fuzzyExtract: function(el) {
				return el.name;
			},

			updateAll: function(tables, now, callback) {

				var that = this;
				var updateOrCreate = function(table, callback) {
					if (!table.hpid || !table.platform) {
						callback('Provided object must contain at least name and platform.');
					}
					that.updateOrCreate({ where: { hpid: table.hpid, platform: table.platform }}, table, callback);
				};

				async.eachSeries(tables, updateOrCreate, function(err) {
					log.debug("[table] Database is now updated.");
					callback(err, tables);
				});
			},

			getEdition: function(name) {
				var edition = 'standard';
				if (name.match(/[^a-z]night[^a-z]*mod|[^a-z0-9]nm\s*$/i)) {
					edition = 'nightmod';
				}
				return edition;
			},

			updateOrCreate: function(clause, table, callback) {
				var that = this;
				delete table.img_playfield; // sequelize doesn't like non-column fields.

				table.edition = Table.getEdition(table.name);

				Table.find(clause).success(function(row) {
					if (row) {

						// don't update name and year if it was already matched by ipdb.org
						if (row.ipdb_no) {
							if (row.name) {
								delete table.name;
							}
							if (row.year) {
								delete table.year;
							}
							// also don't update filename, this should be set explicitly only in post-processing.
							if (row.filename) {
								delete table.filename;
							}
						}

						// never overwrite hpid
						if (row.hpid) {
							delete table.hpid;
						}

						row.updateAttributes(table).success(function(r) {
							callback(null, r);
						});

					} else {
						that.generateKey(3, function(err, key) {
							if (err) {
								return callback(err);
							}
							table.key = key;
							Table.create(table).success(function(r) {
								callback(null, r);
							});
						});
					}
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
				var that = this;
				Table.count({ where: { key: key }}).success(function(num) {
					if (num == 0) {
						callback(null, key);
					} else {
						if (numtry > 9) {
							that.generateKey(length + 1, callback, 0);
						} else {
							that.generateKey(length, callback, numtry + 1);
						}
					}
				}).error(callback);
			}
		},

		instanceMethods: {

			// hooks
/*			beforeCreate: function() {
				this.pass = hashPassword(this.pass);
				this.authtoken = randomKey(32);
			},*/

			map: function(hit) {
				var result = this.values;
				result.name_match = hit ? hit.string : null;
				return result;
			}
		},

		timestamps: true
	});
	return Table;
};