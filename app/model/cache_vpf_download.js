
module.exports = function(sequelize, DataTypes) {

	var CacheVpfDownload = sequelize.define('cache_vpf_downloads', {
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			category: DataTypes.INTEGER,
			letter: DataTypes.STRING,
			title: DataTypes.STRING,
			url: DataTypes.STRING,
			downloads: DataTypes.STRING,
			views: DataTypes.STRING,
			author: DataTypes.STRING,
			lastUpdate: DataTypes.DATE
		},
		{
			classMethods: {

			},

			instanceMethods: {

			},

			timestamps: true
		});
	return CacheVpfDownload;
}

