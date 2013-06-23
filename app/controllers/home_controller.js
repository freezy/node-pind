var util = require('util');
var schema = require('./app/model/schema');

load('application');
before(use('requireUser'));

action('index', function(context) {
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
	this.user = context.req.session.user;
	render();
})

action('table', function(context) {
	this.title = 'Table';
	this.user = context.req.session.user;
	this.id = params.id;
	render();
})
