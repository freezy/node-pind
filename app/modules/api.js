var njrpc = require('./njrpc');

njrpc.register([
	require('./api/pind').api,
	require('./api/control').api,
	require('./api/table').api,
	require('./api/user').api,
	require('./api/hyperpin').api
]);

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