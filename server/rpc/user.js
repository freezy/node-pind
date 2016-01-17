'use strict';

var logger = require('winston');
var schema = require('../database/schema');
var error = require('../modules/error');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce').registerSocketStream(ss);

	return {

		all: function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			var p = {
				order: params && params.order ? params.order.replace(/[^\w\s]*/g, '') : 'name ASC',
				offset: params && params.offset ? parseInt(params.offset) : 0,
				limit: params && params.limit ? parseInt(params.limit) : 0
			};
			if (params.filters && Array.isArray(params.filters)) {
				for (var i = 0; i < params.filters.length; i++) {
					if (i == 0) {
						p.where = '';
					}
					var filter = params.filters[i];
					switch (filter) {
						case 'nocredits':
							p.where += '(`credits` = 0) OR ';
							break;
						case 'hiscore':
							p.where += '(`id` IN (SELECT DISTINCT `userId` FROM `hiscores`)) OR ';
							break;
					}
				}
				if (p.where) {
					p.where = p.where.substr(0, p.where.length - 4);
				}
			}

			schema.User.all(p).then(function(rows) {

				delete p.limit;
				delete p.skip;
				delete p.order;
				schema.User.count(p).then(function(num) {
					logger.log('info', '[db] [user] Returning ' + rows.length + ' rows from a total of ' + num + '.');
					res({ rows : rows, count: num });
				});
			});
		},

		getLeaderboard: function() {

			// access control
			if (!req.session.userId) return res(error.unauthorized());

			schema.sequelize.query(
				'SELECT u.id, u.user, sum(h.points) AS points FROM users u ' +
				'INNER JOIN hiscores h ON h.userId = u.id ' +
				'GROUP BY u.user, u.id ' +
				'ORDER BY points DESC'
			).then(function(rows) {
				res(rows);
			});

		},

		update: function(params) {

			// access control
			if (!req.session.userId) return res(error.unauthorized());
			if (!req.session.user.admin) return res(error.forbidden());

			var allowedFields = [ 'id', 'credits' ];
			if (!params.id) {
				return res(error.api('ID must be set when updating user.'));
			}
			for (var field in params) {
				if (allowedFields.indexOf(field) == -1) {
					return res(error.api('Illegal field "' + field + '".'));
				}
			}
			schema.User.find({ where: { id: params.id } }).then(function(user) {
				if (!user) {
					return res(error.api('No user found with ID "' + params.id + '".'));
				}
				user.updateAttributes(params).then(function(user) {
					ss.publish.user(user.user, 'statusUpdated');
					res(user);
				});
			});
		}
	}
};