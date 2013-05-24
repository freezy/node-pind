var relativeDate = require('relative-date');
var filesize = require('filesize');

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
				},
				map: function(row) {
					var result = row.values ? row.values : row;
					result.queuedSince = relativeDate(result.createdAt);
					result.displaySize = result.size ? filesize(result.size, true) : '';
					return result;
				}
			},

			instanceMethods: {
				map: function() {
					return Transfer.map(this);
				}
			},

			timestamps: true
		});
	return Transfer;
}

