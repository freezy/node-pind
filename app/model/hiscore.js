
module.exports = function(sequelize, DataTypes) {

	var Hiscore = sequelize.define('hiscores', {
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			type: DataTypes.ENUM('champ', 'hiscore', 'buyin_champ', 'buyin_hiscore', 'special'),
			rank: DataTypes.INTEGER,
			title: DataTypes.STRING
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

