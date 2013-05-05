var njrpc = require('./njrpc');

var app;

module.exports = function(app) {
	njrpc.register([
		require('./api/pind')(app).api,
		require('./api/control')(app).api,
		require('./api/table')(app).api,
		require('./api/user').api,
		require('./api/hyperpin')(app).api,
		require('./api/vpforums')(app).api,
		require('./api/transfer')(app).api
	]);
	return exports;
};

exports.handle = function(req, res) {
	njrpc.handle(req, res);
}