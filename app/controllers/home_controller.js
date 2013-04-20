var util = require('util');
var schema = require('./app/model/schema');

load('application');
before(use('requireUser'));

action('index', function (context) {
	var that = this;
	that.title = 'Welcome!';
	schema.sequelize.query(
		'SELECT u.id, u.user, sum(h.points) as totalPoints ' +
		'FROM users u, hiscores h ' +
		'WHERE u.id = h.userId ' +
		'GROUP BY u.id, u.user ' +
		'ORDER BY totalPoints DESC'
	).success(function(rows) {
			that.hiscores = rows;
		render();
	});
});

action('coin', function (context) {
	this.title = 'Coin Drop';
	this.user = context.req.session.user;
	render();
});

action('hiscores', function (context) {
	this.title = 'High Scores';
	this.user = context.req.session.user;
	render();
});


action('tables', function(context) {
	this.title = 'Tables';
	Table.all(function(err, rows) {
		for (var i = 0; i < rows.length; i++) {
			rows[i]['logo'] = pathTo.asset_logo(rows[i].key);
			rows[i]['banner'] = pathTo.asset_banner(rows[i].key);
			rows[i]['portrait_small'] = pathTo.asset_portrait_small(rows[i].key);
		}
		render({ tables : rows });
	});

})
