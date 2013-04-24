var fs = require('fs');

exports.api = function(message, code, data) {
	var error = { error: { message: message } };
	if (code) {
		error.code = code;
	}
	if (data) {
		error.data = data;
	}
	return error;
};

exports.dumpDebugData = function(module, what, data, ext) {
	var filename = __dirname + '/../../debug-' + module + '-' + what + '-' + new Date().getTime() + '.' + (ext ? ext : 'log');
	fs.writeFileSync(filename, data);
	return fs.realpathSync(filename);
}