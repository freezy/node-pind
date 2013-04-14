
module.exports = function(sequelize, DataTypes) {

	var Hiscore = sequelize.define('hiscores', {
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			type: DataTypes.ENUM('champ', 'hiscore', 'buyin_champ', 'buyin_hiscore', 'special'),
			score: DataTypes.INTEGER,
			rank: DataTypes.INTEGER,
			title: DataTypes.STRING,
			info: DataTypes.STRING
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

