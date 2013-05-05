var fuzzy = require('fuzzy');
var relativeDate = require('relative-date');

var _ = require('underscore');

var error = require('./../error');

var schema = require('../../model/schema');

module.exports = function(app) {
	return exports;
};

var VPForumsAPI = function() {
	return {
		name : 'VPForums',

		FindTables : function(req, params, callback) {
			
			var search = params.search && params.search.length > 1;
			var p = { where: { category: 41 }};
			var trim = function(str) {
				str = str.replace(/[\-_]+/g, ' ');
				str = str.replace(/[^\s]\(/g, ' (');
				var m = str.match(/\s+((vp\s*9|v[\d\.]{3,}|fs\s|fs$|\(|\[|mod\s|directB2S|FSLB|B2S|de\s|em\s|BLUEandREDledGImod|8 step GI|FSHD|HR\s|Low Res|night mod).*)/i);
				if (m) {
					var info = m[1];
					var title = str.substr(0, str.length - info.length).trim();
					return [title, info];
				} else {
					return [str, ''];
				}
			};
			var enhance = function(row) {
				var result = row.values;
				var split = trim(result.title);
				result.title_match = row.string;
				result.title_trimmed = split[0];
				result.info = split[1];
				result.lastUpdateRel = relativeDate(result.lastUpdate);
				return result;
			}
			// pagination
			if (!search) {
				p.offset = params.offset ? parseInt(params.offset) : 0;
				p.limit = params.limit ? parseInt(params.limit) : 0;
			}
			// sort
			if (params.order) {
				switch(params.order) {
					case 'downloads':
						p.order = 'downloads DESC';
						break;
					case 'views':
						p.order = 'views DESC';
						break;
					case 'latest':
					default:
						p.order = 'lastUpdate DESC';
				}
			} else {
				p.order = 'lastUpdate DESC';
			}
			schema.CacheVpfDownload.all(p).success(function(rows) {

				if (search) {
					console.log('Fuzzy-filtering ' + rows.length + ' rows...');
					var options = {
						pre: '<b>',
						post: '</b>',
						extract: function(el) { return el.title; }
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

					// enhance and return
					var results = [];
					_.each(pagedResults, function(hit) {
						results.push(enhance(hit.original));
					});
					return callback({ rows : results, count: hits.length });					
				}


				var returnedRows = [];
				_.each(rows, function(row) {
					returnedRows.push(enhance(row));
				});

				delete p.limit;
				delete p.offset;
				delete p.order;
				schema.CacheVpfDownload.count(p).success(function(num) {

					console.log('Returning ' + rows.length + ' rows from a total of ' + num + '.');
					callback({ rows: returnedRows, count: num });

				}).error(function(err) {
					throw new Error(err);
				});
			});
		}
	};
};

exports.api = new VPForumsAPI();