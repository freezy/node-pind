var schema = require('../database/schema');
var error = require('../modules/error');

exports.actions = function(req, res, ss) {
	req.use('session');
	require('../modules/announce')().registerSocketStream(ss);

	return {

		all: function(params) {
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

			schema.User.findAll(p).success(function(rows) {

				delete p.limit;
				delete p.skip;
				delete p.order;
				schema.User.count(p).success(function(num) {

					console.log('Returning ' + rows.length + ' rows from a total of ' + num + '.');
					res({ rows : rows, count: num });

				}).error(function(err) {
						throw Error(err);
					});

			}).error(function(err) {
					throw Error(err);
				});
		},

		update: function(params) {
			var allowedFields = [ 'id', 'credits' ];
			if (!params.id) {
				return res(error.api('ID must be set when updating user.'));
			}
			for (var field in params) {
				if (allowedFields.indexOf(field) == -1) {
					return res(error.api('Illegal field "' + field + '".'));
				}
			}
			schema.User.find({ where: { id: params.id } }).success(function(user) {
				if (!user) {
					return res(error.api('No user found with ID "' + params.id + '".'));
				}
				user.updateAttributes(params).success(function(user) {
					res(user);

				});
			});
		}
	}
};