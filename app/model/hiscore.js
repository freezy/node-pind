
module.exports = function(sequelize, DataTypes) {

	var Hiscore = sequelize.define('hiscores', {
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
			player: DataTypes.STRING,
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE
		},
		{
			classMethods: {

			},

			instanceMethods: {

			},

			timestamps: false
		});
	return Hiscore;
}

