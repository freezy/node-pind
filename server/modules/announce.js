'use strict';

var _ = require('underscore');
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

Announce.prototype._publish = function(event, data, ns, who) {
	// always emit on self
	var name = ns ? ns + '.' + event : event;
	this.emit(name, data);
	if (socketstream) {
		logger.log('info', '[announce] "%s": %j', name, data, {});
		if (!who || who == 'all') {
			socketstream.publish.all(name, data);
		} else if (who == 'admin') {
			socketstream.publish.channel('admin', name, data);
		} else if (data._user) {
			socketstream.publish.user(data._user, name, data);
		} else {
			logger.log('error', '[announce] Skipping event "%s", unknown channel "%s".', name, who, {});
		}
	} else {
		logger.log('warn', '[announce] Skipping event "%s", SocketStream unavailable.', name);
	}
};

/**
 * Object gets send without change to socket with the same event name.
 * @param emitter Event emitter
 * @param event Name of the event
 * @param ns Namespace - prefix added to event name, separated by a dot.
 * @param who Receipents - null is everybody, valid values are "user" and "admin".
 */
Announce.prototype.forward = function(emitter, event, ns, who) {
	var that = this;
	emitter.on(event, function(obj) {
		that._publish(event, obj, ns, who);
	});
};

/**
 * A notice gets send with a given message.
 * @param emitter Event emitter
 * @param event Name of the event
 * @param message Message to send. Use {{varname}} if payload contains values.
 * @param timeout If set, override default timeout to send to client
 * @param who Receipents - null is everybody, valid values are "user" and "admin".
 */
Announce.prototype.notice = function(emitter, event, message, who, timeout) {
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
		}, null, who);
	});
};

/**
 * Sends given data with the same event name
 * @param emitter Event emitter
 * @param event Name of the event
 * @param data Data to send
 * @param ns Namespace - prefix added to event name, separated by a dot.
 * @param eventName If set, change event name to this value instead of original value
 * @param who Receipents - null is everybody, valid values are "user" and "admin".
 */
Announce.prototype.data = function(emitter, event, data, ns, who, eventName) {
	var that = this;
	emitter.on(event, function() {
		that._publish(eventName ? eventName : event, data, ns, who);
	});
};

Announce.prototype.transferProgress = function(emitter, event, ns) {
	var that = this;
	emitter.on(event, function(data) {
		that._publish(event, {
			id: data.reference.id,
			totalSize: data.contentLength,
			downloadedSize: data.size
		}, ns, 'admin');
	});
};

Announce.prototype.transferUpdate = function(emitter, event, ns) {
	var that = this;
	emitter.on(event, function(data) {
		that._publish('transferUpdated', { id: data.transfer.id }, ns, 'admin');
	});
};

module.exports = new Announce();