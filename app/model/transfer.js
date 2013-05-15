var relativeDate = require('relative-date');

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
			startedAt: DataTypes.DATE,
			completedAt: DataTypes.DATE,
			failedAt: DataTypes.DATE,
			result: DataTypes.TEXT,
			sort: DataTypes.BIGINT
		},
		{
			classMethods: {
				fuzzyExtract: function(row) {
					return row.title;
				}
			},

			instanceMethods: {
				map: function() {
					var result = this.values;
					result.queuedSince = relativeDate(result.createdAt);
					return result;
				}
			},

			timestamps: true
		});
	return Transfer;
}

