var error = require('./../error');

var schema = require('../../model/schema');

module.exports = function(app) {
	return exports;
};

var VPForumsAPI = function() {
	return {
		name : 'VPForums',

		FindTables : function(req, params, callback) {
			var trim = function(str) {
				str = str.replace(/[\-_]+/g, ' ');
				str = str.replace(/[^\s]\(/g, ' (');
				var m = str.match(/\s+((vp9|fs\s|fs$|\(|\[|mod\s|directB2S|FSLB|B2S|de\s|em\s|BLUEandREDledGImod).*)/i);
				if (m) {
					var info = m[1];
					var title = str.substr(0, str.length - info.length).trim();
					return [title, info];
				} else {
					return [str, ''];
				}
			};
			schema.CacheVpfDownload.all({ order: 'lastUpdate DESC' }).success(function(rows) {
				var pagedRows = rows.slice(0, 100);
				var returnedRows = [];
				for (var i = 0; i < pagedRows.length; i++) {
					var row = pagedRows[i].values;
					var split = trim(row.title);
					row.title_trimmed = split[0];
					row.info = split[1];

					returnedRows.push(row);
				}
				callback({ rows: returnedRows, num: rows.length });
			});
		}
	};
};

exports.api = new VPForumsAPI();