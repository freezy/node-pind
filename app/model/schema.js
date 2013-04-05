var Sequelize = require('sequelize');
var settings = require('../../config/settings-mine');


var config = {

	// disable logging
	logging: false,

	define: {
		classMethods: {
			c: function(data) {
				var obj = this.build(data);
				if (typeof(obj.beforeCreate) == 'function') {
					obj.beforeCreate();
				}
				if (typeof(obj.beforeSave) == 'function') {
					obj.beforeSave();
				}
				return obj.save();
			},

			u: function(data) {
				var obj = this.build(data);
				if (typeof(obj.beforeUpdate) == 'function') {
					obj.beforeUpdate();
				}
				if (typeof(obj.beforeSave) == 'function') {
					obj.beforeSave();
				}
				return obj.save();
			}
		}
	}
};

// update config with individual settings
if (settings.pind.database.engine == 'mysql') {
	config.dialect = 'mysql';
	config.host = settings.pind.database.host;
	config.port = settings.pind.database.port;
	config.define = { engine: 'MYISAM' };
	// use pooling in order to reduce db connection overload and to increase speed
	// currently only for mysql
	config.pool = { maxConnections: 5, maxIdleTime: 30 };
	config.freezeTableName = false;

} else if (settings.pind.database.engine == 'sqlite') {
	config.dialect = 'sqlite';
	config.storage = settings.pind.database.database + '.db';
} else {
	throw new Error('Unknown database engine (' + settings.pind.database.engine + ').');
}

// instantiate db engine
var sequelize = new Sequelize(
	settings.pind.database.database,
	settings.pind.database.user,
	settings.pind.database.pass,
	config
);

Users = sequelize.import(__dirname + '/user');
Tables = sequelize.import(__dirname + '/table');

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