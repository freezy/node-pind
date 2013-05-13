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
			fileId: DataTypes.STRING,
			downloads: DataTypes.INTEGER,
			views: DataTypes.INTEGER,
			author: DataTypes.STRING,
			lastUpdatedAt: DataTypes.DATE,
			downloadQueuedAt: DataTypes.DATE,
			downloadStartedAt: DataTypes.DATE,
			downloadFailedAt: DataTypes.DATE,
			downloadCompletedAt: DataTypes.DATE
		},
		{
			classMethods: {
				fuzzyExtract: function(el) {
					return el.title;
				},


				/**
				 * Splits the title into two parts: the "real" title and all the tags that fly along.
				 * @param title
				 * @returns {Array}
				 */
				splitName: function(title) {
					title = title.replace(/[\-_]+/g, ' ');
					title = title.replace(/[^\s]\(/g, ' (');
					var m = title.match(/\s+((vp\s*9|v[\d\.]{3,}|fs\s|fs$|\(|\[|mod\s|directB2S|FSLB|B2S|de\s|em\s|BLUEandREDledGImod|8 step GI|FSHD|HR\s|Low Res|night mod).*)/i);
					if (m) {
						var info = m[1];
						var title = title.substr(0, title.length - info.length).trim();
						return [title, info];
					} else {
						return [title, ''];
					}
				}
			},

			instanceMethods: {
				map: function(hit) {
					var result = this.values;
					var split = VpfFile.splitName(result.title);
					result.title_match = hit ? hit.string : null;
					result.title_trimmed = split[0];
					result.info = split[1];
					result.lastUpdatedSince = relativeDate(result.lastUpdatedAt);
					if (this.downloadCompletedAt) {
						result.downloadStatus = 'completed'
					} else if (this.downloadFailedAt) {
						result.downloadStatus = 'failed'
					} else if (this.downloadStartedAt) {
						result.downloadStatus = 'started'
					} else if (this.downloadQueuedAt) {
							result.downloadStatus = 'queued'
					} else {
						result.downloadStatus = 'none'
					}

					return result;
				}
			},

			timestamps: true
		});

	return VpfFile;
}
