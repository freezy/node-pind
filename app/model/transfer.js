
module.exports = function(sequelize, DataTypes) {

	var Transfer = sequelize.define('transfers', {
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			title: DataTypes.STRING,
			url: DataTypes.STRING,
			type: DataTypes.ENUM('rom', 'table', 'mediapack', 'video'),
			engine: DataTypes.ENUM('vpf', 'ipdb'),
			reference: DataTypes.INTEGER,
			postAction: DataTypes.TEXT,
			size: DataTypes.BIGINT,
			started: DataTypes.DATE,
			completed: DataTypes.DATE,
			failed: DataTypes.DATE,
			result: DataTypes.TEXT
		},
		{
			classMethods: {
				fuzzyExtract: function(row) {
					return row.title;
				}
			},

			instanceMethods: {

			},

			timestamps: true
		});
	return Transfer;
}

