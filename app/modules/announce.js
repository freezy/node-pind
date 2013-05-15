/*var socket, emitter;
var defaultTimeout = 2000;

module.exports = function(app, e) {
	emitter = e;
	socket = app.get('socket.io');
	return exports;
}

exports.forward = function(event) {
	emitter.on(event, function(obj) {
		socket.emit(event, obj);
	});
};

exports.notice = function(event, message, timeout) {
	console.log('****** REGISTERING NOTICE "%s"', event);
	emitter.on(event, function(values) {
		console.log('****** NOTICE: %s', message);
		if (values) {
			var regex = new RegExp('{{([^}]+)}}', 'g');
			var m;
			while (m = regex.exec(message)) {
				message = message.replace('{{' + m[1] + '}}', values[m[1]]);
			}
		}
		socket.emit('notice', {
			msg: message,
			timeout: timeout ? timeout : defaultTimeout
		});
	});
};

exports.data = function(event, data) {
	emitter.on(event, function() {
		socket.emit(event, data);
	});
};

exports.register = function(socket) {



	// object gets send without change to socket with the same event name.

	// a notice gets send with a given message.

	// sends given data with the same event name

	// HyperPin.syncTablesWithData()
/*	data(hp, 'processingStarted', { id: '#hpsync' });
	notice(hp, 'syncCompleted', 'Done syncing, starting analysis...');
	notice(hp, 'analysisCompleted', 'Finished analyzing tables.', 5000);
	data(hp, 'processingCompleted', { id: '#hpsync' });

	// HyperPin.syncTables()
	notice(hp, 'xmlParsed', 'Read {{num}} tables from {{platform}}.xml, updating local database...');
	notice(hp, 'tablesUpdated', 'Updated {{num}} tables in database.');

	// HyperPin.findMissingMedia()
	notice(hp, 'searchStarted', 'Searching {{what}} for "{{name}}"', 60000);
	notice(hp, 'searchCompleted', 'Download successful, extracting missing media files');
	forward(hp, 'tableUpdated');

	// VisualPinball.updateTableData()
	notice(vp, 'analysisStarted', 'Analyzing {{name}}...');*/

//};
