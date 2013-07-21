module.exports = function(sequelize, DataTypes) {

	var Rom = sequelize.define('roms', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true
		},
		mpu: DataTypes.STRING, // microprocessor unit, see ipdb.org
		extraBalls: DataTypes.INTEGER,
		gamesStarted: DataTypes.INTEGER,
		gamesPlayed: DataTypes.INTEGER,
		playTime: DataTypes.BIGINT,
		runningTime: DataTypes.BIGINT,
		ballsPlayed: DataTypes.INTEGER,
		scoreHistogram: DataTypes.TEXT,
		playtimeHistogram: DataTypes.TEXT
	},
	{
		classMethods: {
		},

		instanceMethods: {
		},

		timestamps: true
	});
	return Rom;
};