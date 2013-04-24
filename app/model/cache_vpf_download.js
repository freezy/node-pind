
module.exports = function(sequelize, DataTypes) {

	var CacheVpfDownload = sequelize.define('cache_vpf_downloads', {
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			category: DataTypes.INTEGER,
			letter: DataTypes.STRING,
			data: DataTypes.TEXT
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

