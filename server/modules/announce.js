'use strict';

var util = require('util');
var events = require('events');
var logger = require('winston');

var defaultTimeout = 2000;
var socketstream = null;

function Announce() {
	events.EventEmitter.call(this);
}
util.inherits(Announce, events.EventEmitter);

Announce.prototype.registerSocketStream = function(_ss) {
	if (!socketstream) {
		logger.log('info', '[announce] SocketStream event listener registered.');
		socketstream = _ss;
	}
};

Announce.prototype._publish = function(event, data, ns) {
	// always emit on self
	var name = ns ? ns + '.' + event : event;
	this.emit(name, data);
	if (socketstream) {
		logger.log('info', '[announce] "%s": %j', name, data, {});
		socketstream.publish.all(name, data);
	}
};

/**
 * Object gets send without change to socket with the same event name.
 * @param emitter Event emitter
 * @param event Name of the event
 * @param ns Namespace - prefix added to event name, separated by a dot.
 */
Announce.prototype.forward = function(emitter, event, ns) {
	var that = this;
	emitter.on(event, function(obj) {
		that._publish(event, obj, ns);
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
 * @param ns Namespace - prefix added to event name, separated by a dot.
 * @param eventName If set, change event name to this value instead of original value
 */
Announce.prototype.data = function(emitter, event, data, ns, eventName) {
	var that = this;
	emitter.on(event, function() {
		that._publish(eventName ? eventName : event, data, ns);
	});
};

Announce.prototype.transferProgress = function(emitter, event, ns) {
	var that = this;
	emitter.on(event, function(data) {
		that._publish(event, {
			id: data.reference.id,
			totalSize: data.contentLength,
			downloadedSize: data.size
		}, ns);
	});
};

Announce.prototype.transferUpdate = function(emitter, event, ns) {
	var that = this;
	emitter.on(event, function(data) {
		that._publish('transferUpdated', { id: data.transfer.id }, ns);
	});
};

module.exports = new Announce();