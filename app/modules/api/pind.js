var api = require('../api');
var ipdb = require('../ipdb');
var vpm = require('../vpinmame');

var tableApi = require('./table').api;

var PindApi = function() {
	return {
		name : 'Pind',

		FetchIPDB : function(req, params, callback) {
			ipdb.syncIPDB(function(err, tables) {
				if (err) {
					throw new Error(err);
				}
				tableApi.GetAll(req, params, callback);
			});
		},

		FetchHiscores : function(req, params, callback) {
			vpm.fetchHighscores(function(err) {
				if (!err) {
					callback({ message: 'Highscores updated successfully.' });
				} else {
					callback(api.error(err));
				}
			});
		}
	};
};

exports.api = new PindApi();