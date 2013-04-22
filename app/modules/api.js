var njrpc = require('./njrpc');

var app;

module.exports = function(app) {
	njrpc.register([
		require('./api/pind')(app).api,
		require('./api/control')(app).api,
		require('./api/table')(app).api,
		require('./api/user').api,
		require('./api/hyperpin')(app).api
	]);
	return exports;
};

exports.handle = function(req, res) {
	njrpc.handle(req, res);
}

exports.error = function(message, code, data) {
	var error = { error: { message: message } };
	if (code) {
		error.code = code;
	}
	if (data) {
		error.data = data;
	}
	return error;
};