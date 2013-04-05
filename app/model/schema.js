var Sequelize = require('sequelize');

var sequelize = new Sequelize('pind', 'pind', 'p1nd',  {
	dialect: 'mysql',
	storage: 'pind.db',

	define: {
		classMethods: {
			c: function(data) {
				var obj = this.build(data);
				if (typeof(obj.beforeCreate) == "function") {
					obj.beforeCreate();
				}
				if (typeof(obj.beforeSave) == "function") {
					obj.beforeSave();
				}
				return obj.save();
			},

			u: function(data) {
				var obj = this.build(data);
				if (typeof(obj.beforeUpdate) == "function") {
					obj.beforeUpdate();
				}
				if (typeof(obj.beforeSave) == "function") {
					obj.beforeSave();
				}
				return obj.save();
			}
		}
	}
});

Users = sequelize.import(__dirname + "/user");
Tables = sequelize.import(__dirname + "/table");

sequelize.sync().on('success', function() {
	console.log('Connected to SQLite.');
}).error(function(err){
	console.log('Error connecting to SQLite: ' + err);
});

create = function(next){
	sequelize.sync({force: true}).on('success', function() {
		next();
	}).error(function(err){
		next(err);
	});
}

module.exports = {
	sequelize: sequelize,
	create: create,
	Table:  Tables,
	User:  Users
};