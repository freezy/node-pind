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
		result: DataTypes.TEXT,
		startedAt: DataTypes.DATE,
		completedAt: DataTypes.DATE
	},
	{
		classMethods: {
		},

		instanceMethods: {
		},

		timestamps: false
	});
};