var socket, emitter;
var defaultTimeout = 2000;

module.exports = function(app, e) {
	emitter = e;
	socket = app.get('socket.io');
	return exports;
}

/**
 * object gets send without change to socket with the same event name.
 * @param event
 */
exports.forward = function(event) {
	emitter.on(event, function(obj) {
		socket.emit(event, obj);
	});
};

/**
 * a notice gets send with a given message.
 * @param event
 * @param message
 * @param timeout
 */
exports.notice = function(event, message, timeout) {
	emitter.on(event, function(values) {
		var msg = message;
		if (values) {
			var regex = new RegExp('{{([^}]+)}}', 'g');
			var m;
			while (m = regex.exec(message)) {
				msg = msg.replace('{{' + m[1] + '}}', values[m[1]]);
			}
		}
		socket.emit('notice', {
			msg: msg,
			timeout: timeout ? timeout : defaultTimeout
		});
	});
};

/**
 * sends given data with the same event name
 * @param event
 * @param data
 * @param eventName
 */
exports.data = function(event, data, eventName) {
	emitter.on(event, function() {
		socket.emit(eventName ? eventName : event, data);
	});
};
