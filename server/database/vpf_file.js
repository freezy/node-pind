var relativeDate = require('relative-date');

module.exports = function(sequelize, DataTypes) {

	var VpfFile = sequelize.define('vpf_file', {
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			category: DataTypes.INTEGER,
			letter: DataTypes.STRING,
			title: DataTypes.STRING,
			description: DataTypes.TEXT,
			fileId: DataTypes.STRING,
			downloads: DataTypes.INTEGER,
			views: DataTypes.INTEGER,
			author: DataTypes.STRING,
			lastUpdatedAt: DataTypes.DATE
		},
		{
			classMethods: {
				fuzzyExtract: function(el) {
					return el.title;
				},


				/**
				 * Splits the title into two parts: the "real" title and all the tags that fly along.
				 * @param result
				 * @returns {Array}
				 */
				splitName: function(result) {
					var title = result.title;
					title = title.replace(/[\-_]+/g, ' ');
					title = title.replace(/[^\s]\(/g, ' (');
					title = title.replace(result.author, '');
					var m = title.match(/\s+((vp\s*9|v[\d\.]{3,}|fs\s|fs$|\(|\[|mod\s|directB2S|FSLB|B2S|de\s|em\s|BLUEandREDledGImod|8 step GI|FSHD|HR\s|Low Res|night mod|chrome edition|data east|williams|bally|stern|gottlieb|capcom).*)/i);
					if (m) {
						var info = m[1];
						title = title.substr(0, title.length - info.length).trim();
						return [title, info];
					} else {
						return [title, ''];
					}
				},

				map: function(row, hit) {
					var result = row.values ? row.values : row;
					var split = this.splitName(result);
					result.title_match = hit ? hit.string : null;
					result.title_trimmed = split[0];
					result.info = split[1];
					var lastUpdatedAt = result.lastUpdatedAt instanceof Date ? result.lastUpdatedAt : new Date(Date.parse(result.lastUpdatedAt + ' UTC'));
					result.lastUpdatedSince = relativeDate(lastUpdatedAt);
					if (row.completedAt) {
						result.downloadStatus = 'completed'
					} else if (row.failedAt) {
						result.downloadStatus = 'failed'
					} else if (row.startedAt) {
						result.downloadStatus = 'started'
					} else if (row.queuedAt) {
						result.downloadStatus = 'queued'
					} else {
						result.downloadStatus = 'none'
					}
					result.url = 'http://www.vpforums.org/index.php?app=downloads&showfile=' + result.fileId;

					var ipdb = require('./../modules/ipdb');
					var m, regex = new RegExp(ipdb.getKnownManufacturers().join('|').toLowerCase(), 'i');
					if (m = regex.exec(result.title)) {
						result.manufacturer = m[0];
					}
					if (m = result.title.match(/(19[5-9]\d|20\d{2})/)) {
						result.year = m[1];
					}

					return result;
				}
			},

			instanceMethods: {
				map: function(hit) {
					return VpfFile.map(this, hit);
				}
			},

			timestamps: true
		});

	return VpfFile;
};
