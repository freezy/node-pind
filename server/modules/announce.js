var util = require('util');
var events = require('events');

var defaultTimeout = 2000;
var socketstream = null;

function Announce() {
	if ((this instanceof Announce) === false) {
		return new Announce();
	}
	events.EventEmitter.call(this);
}
util.inherits(Announce, events.EventEmitter);

Announce.prototype.registerSocketStream = function(_ss) {
	socketstream = _ss;
};

Announce.prototype._publish = function(event, data) {
	// always emit on self
	this.emit(event, data);
	if (socketstream) {
		socketstream.publish.all(event, data);
	}
};

/**
 * Object gets send without change to socket with the same event name.
 * @param emitter Event emitter
 * @param event Name of the event
 */
Announce.prototype.forward = function(emitter, event) {
	var that = this;
	emitter.on(event, function(obj) {
		that._publish(event, obj);
	});
};

/**
 * A notice gets send with a given message.
 * @param emitter Event emitter
 * @param event Name of the event
 * @param message Message to send. Use {{varname}} if payload contains values.
 * @param timeout If set, override default timeout to send to client
 */
Announce.prototype.notice = function(emitter, event, message, timeout) {
	var that = this;
	emitter.on(event, function(values) {
		var msg = message;
		if (values) {
			var regex = new RegExp('{{([^}]+)}}', 'g');
			var m;
			while (m = regex.exec(message)) {
				msg = msg.replace('{{' + m[1] + '}}', values[m[1]]);
			}
		}
		that._publish('console', {
			msg: msg,
			timeout: timeout ? timeout : defaultTimeout
		});
	});
};

/**
 * Sends given data with the same event name
 * @param emitter Event emitter
 * @param event Name of the event
 * @param data Data to send
 * @param eventName If set, change event name to this value instead of original value
 */
Announce.prototype.data = function(emitter, event, data, eventName) {
	var that = this;
	emitter.on(event, function() {
		that._publish(eventName ? eventName : event, data);
	});
};

Announce.prototype.downloadWatch = function(emitter, event) {
	var that = this;
	emitter.on(event, function(data) {
		that._publish('downloadWatch', {
			id: data.reference.id,
			totalSize: data.contentLength,
			downloadedSize: data.size
		});
	});
};

Announce.prototype.transferUpdate = function(emitter, event) {
	var that = this;
	emitter.on(event, function(data) {
		that._publish('transferUpdated', { id: data.transfer.id });
	});
};

module.exports = Announce;