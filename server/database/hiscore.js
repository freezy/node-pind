
module.exports = function(sequelize, DataTypes) {

	return sequelize.define('hiscores', {
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			type: DataTypes.ENUM('champ', 'hiscore', 'buyin_champ', 'buyin_hiscore', 'special'),
			score: DataTypes.BIGINT,
			rank: DataTypes.INTEGER,
			points: DataTypes.INTEGER,
			title: DataTypes.STRING,
			info: DataTypes.STRING,
			player: DataTypes.STRING
		},
		{
			classMethods: {

			},

			instanceMethods: {

			},

			timestamps: true
		});
};