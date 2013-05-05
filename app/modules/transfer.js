var fs = require('fs');

var settings = require('../../config/settings-mine');
var schema = require('../model/schema');

var socket;

module.exports = function(app) {
	socket = app.get('socket.io');
	return exports;
};

exports.addVPFTable = function() {



};