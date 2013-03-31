$(document).ready(function() {
	api('Table.GetAll', {}, function(err, result) {
		if (err) {
			alert('Problem: ' + err);
		} else {
			var rows = result.rows;
			var $tbody = $('.admin #tables tbody');
			for (var i = 0; i < rows.length; i++) {
				var tr = '<tr><td>' + rows[i].filename + '</td><td>';
				if (rows[i].media_video) {
					tr += '<span class="badge badge-success">V</span>'
				} else {
					tr += '<span class="badge badge-important">V</span>'
				}
				tr += '</td></tr>';
				$(tr).appendTo($tbody);
			}
		}
	});
});

function api(method, params, callback) {
	$.ajax({
		url: '/api',
		type: 'POST',
		beforeSend: function(xhr) {
			xhr.setRequestHeader('Content-Type', 'application/json');
		},
		dataType: 'text',
		data: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params})
	}).done(function(data) {
		var ret = JSON.parse(data);
		if (ret.error) {
			callback(ret.error.message, ret.error);
		} else {
			callback(null, ret.result);
		}
	});
}