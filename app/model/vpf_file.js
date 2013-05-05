
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

			},

			instanceMethods: {

			},

			timestamps: true
		});

	return VpfFile;
}

