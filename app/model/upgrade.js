var relativeDate = require('relative-date');

module.exports = function(sequelize, DataTypes) {

	return sequelize.define('upgrades', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true
		},
		fromSha: DataTypes.STRING,
		toSha: DataTypes.STRING,
		status: DataTypes.STRING,
		repo: DataTypes.STRING,
		result: DataTypes.TEXT,
		log: DataTypes.TEXT,
		startedAt: DataTypes.DATE,
		completedAt: DataTypes.DATE
	},
	{
		classMethods: {
		},

		instanceMethods: {
			map: function() {
				var result = this.values;
				result.result = JSON.parse(result.result);
				result.log = JSON.parse(result.log);
				result.startedSince = relativeDate(result.startedAt);
				result.completedSince = relativeDate(result.completedAt);
				return result;
			}
		},

		timestamps: false
	});
};