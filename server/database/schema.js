'use strict';

var _ = require('underscore');
var clc = require('cli-color');
var path = require('path');
var fuzzy = require('fuzzy');
var logger = require('winston');
var Sequelize = require('sequelize');

var settings = require('../../config/settings-mine');

var config = {

	// enable/disable logging
	logging: function(msg) {
		logger.log('info', clc.magentaBright.bgRed(msg.replace(/^executing:\s+/i, '')));
	},

	// disable inserting undefined values as NULL
	omitNull: true,

	define: {
		classMethods: {

			fuzzySearch: function(rows, params, callback) {
				logger.log('info', '[db] Fuzzy-filtering ' + rows.length + ' rows...');
				var options = {
					pre: '<b>',
					post: '</b>',
					extract: this.fuzzyExtract
				};
				var hits = fuzzy.filter(params.search, rows, options);
				logger.log('info', '[db] Fuzzy-filtered ' + hits.length + ' hits.');

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
	logger.log('info', '[db] SQLite storage file at %s.', config.storage);

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
var User = sequelize.import(__dirname + '/user');
var Table = sequelize.import(__dirname + '/table');
var Rom = sequelize.import(__dirname + '/rom');
var Hiscore = sequelize.import(__dirname + '/hiscore');
var Transfer = sequelize.import(__dirname + '/transfer');
var VpfFile = sequelize.import(__dirname + '/vpf_file');
var Upgrade = sequelize.import(__dirname + '/upgrade');


// setup associations
User.hasMany(Hiscore);
Table.hasMany(Hiscore);
Hiscore.belongsTo(User);
Hiscore.belongsTo(Table);


sequelize.sync().then(function() {
	logger.log('info', '[db] Connected to %s.', settings.pind.database.engine == 'mysql' ? "MySQL" : "SQLite");
}).catch(function(err){
	logger.log('error', '[db] Error connecting to SQLite: ' + err);
});

var create = function(next){
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
	Rom: Rom,
	User: User,
	Hiscore: Hiscore,
	Transfer: Transfer,
	VpfFile: VpfFile,
	Upgrade: Upgrade
};
