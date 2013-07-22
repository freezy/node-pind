var _ = require('underscore');
var fs = require('fs');
var ent = require('ent');
var util = require('util');
var fuzzy = require('fuzzy');

var error = require('../error');
var schema = require('../../model/schema');
var settings = require('../../../config/settings-mine');

var pathTo;

module.exports = function(app) {
	pathTo = app.compound.map.pathTo;
	return exports;
};

var TableApi = function() {

};


exports.api = new TableApi();