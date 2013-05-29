var defaultTimeout = 2000;
var socket, emitter;

module.exports = function(app, e) {
	emitter = e;
	socket = app.get('socket.io');
	return exports;
};

/**
 * Object gets send without change to socket with the same event name.
 * @param event Name of the event
 */
exports.forward = function(event) {
	emitter.on(event, function(obj) {
		socket.emit(event, obj);
	});
};

/**
 * A notice gets send with a given message.
 * @param event Name of the event
 * @param message Message to send. Use {{varname}} if payload contains values.
 * @param timeout If set, override default timeout to send to client
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
 * Sends given data with the same event name
 * @param event Name of the event
 * @param data Data to send
 * @param eventName If set, change event name to this value instead of original value
 */
exports.data = function(event, data, eventName) {
	emitter.on(event, function() {
		socket.emit(eventName ? eventName : event, data);
	});
};

exports.downloadWatch = function(event) {
	emitter.on(event, function(data) {
		socket.emit('downloadWatch', {
			id: data.reference.id,
			totalSize: data.contentLength,
			downloadedSize: data.size
		});
	});
};

exports.transferUpdate = function(event) {
	emitter.on(event, function(data) {
		socket.emit('transferUpdated', { id: data.transfer.id });
	});
};