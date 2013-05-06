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
			lastUpdate: DataTypes.DATE,
			downloaded: DataTypes.DATE
		},
		{
			classMethods: {
				fuzzyExtract: function(el) {
					return el.title;
				}
			},

			instanceMethods: {
				enhance: function(hit) {
					var result = this.values;
					var split = trim(result.title);
					result.title_match = hit ? hit.string : null;
					result.title_trimmed = split[0];
					result.info = split[1];
					result.lastUpdateRel = relativeDate(result.lastUpdate);
					return result;
				}
			},

			timestamps: true
		});

	return VpfFile;
}

function trim(str) {
	str = str.replace(/[\-_]+/g, ' ');
	str = str.replace(/[^\s]\(/g, ' (');
	var m = str.match(/\s+((vp\s*9|v[\d\.]{3,}|fs\s|fs$|\(|\[|mod\s|directB2S|FSLB|B2S|de\s|em\s|BLUEandREDledGImod|8 step GI|FSHD|HR\s|Low Res|night mod).*)/i);
	if (m) {
		var info = m[1];
		var title = str.substr(0, str.length - info.length).trim();
		return [title, info];
	} else {
		return [str, ''];
	}
}