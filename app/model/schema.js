var _ = require('underscore');
var path = require('path');
var fuzzy = require('fuzzy');
var Sequelize = require('sequelize');

var settings = require('../../config/settings-mine');

var config = {

	// enable/disable logging
	logging: false, //console.log,

	// disable inserting undefined values as NULL
	omitNull: true,

	define: {
		classMethods: {

			fuzzySearch: function(rows, params, callback) {
				console.log('Fuzzy-filtering ' + rows.length + ' rows...');
				var options = {
					pre: '<b>',
					post: '</b>',
					extract: this.fuzzyExtract
				};
				var hits = fuzzy.filter(params.search, rows, options);
				console.log('Fuzzy-filtered ' + hits.length + ' hits.');

				// paging needs to be done manually
				var pagedResults;
				var offset = params.offset ? parseInt(params.offset) : 0;
				var limit = params.limit ? parseInt(params.limit) : 0;
				if (offset || limit) {
					pagedResults = hits.slice(offset, offset + limit);
				} else {
					pagedResults = hits;
				}

				// search for map function either in class or instance.
				var results = [];
				var mapI = pagedResults.length > 0 && pagedResults[0].original.map instanceof Function;
				var mapC = this.map instanceof Function;
				var that = this;
				_.each(pagedResults, function(hit) {
					results.push(mapI ? hit.original.map(hit) :
					            (mapC ? that.map(hit.original, hit) :
					             hit.original)
					);
				});

				callback({ rows: results, count: hits.length });
			}
		}
	}
};

// update config with individual settings
if (settings.pind.database.engine == 'mysql') {
	config.dialect = 'mysql';
	config.host = settings.pind.database.host;
	config.port = settings.pind.database.port;
	config.define.engine = 'MYISAM';
	// use pooling in order to reduce db connection overload and to increase speed
	// currently only for mysql
	config.pool = { maxConnections: 5, maxIdleTime: 30 };
	config.freezeTableName = false;

} else if (settings.pind.database.engine == 'sqlite') {
	config.dialect = 'sqlite';
	if (settings.pind.database.database.indexOf(':') > 0) {
		// path was provided
		config.storage = settings.pind.database.database + '.db';
	} else {
		config.storage = path.normalize(__dirname + '../../../' + settings.pind.database.database + '.db');
	}
	console.log('SQLite storage file at %s.', config.storage);

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

// retrieve base definitions
User = sequelize.import(__dirname + '/user');
Table = sequelize.import(__dirname + '/table');
Hiscore = sequelize.import(__dirname + '/hiscore');
Transfer = sequelize.import(__dirname + '/transfer');
VpfFile = sequelize.import(__dirname + '/vpf_file');


// setup associations
User.hasMany(Hiscore);
Table.hasMany(Hiscore);
Hiscore.belongsTo(User);
Hiscore.belongsTo(Table);

/*
sequelize.sync().on('success', function() {
	console.log('Connected to %s.', settings.pind.database.engine == 'mysql' ? "MySQL" : "SQLite");
}).error(function(err){
	console.log('Error connecting to SQLite: ' + err);
});
*/

create = function(next){
	sequelize.sync({force: true}).on('success', function() {
		next();
	}).error(function(err){
		next(err);
	});
};

module.exports = {
	sequelize: sequelize,
	create: create,
	Table: Table,
	User: User,
	Hiscore: Hiscore,
	Transfer: Transfer,
	VpfFile: VpfFile
};
