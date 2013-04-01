$(document).ready(function() {

	// fetch tables
	api('Table.GetAll', {}, function(err, result) {
		if (err) {
			alert('Problem: ' + err);
		} else {
			updateTables(result.rows);
		}
	});

	// enable reload button
	$('.admin .tables-placeholder button').click(function() {
		var that = $(this);
		that.attr('disabled', 'disabled');
		that.find('.icon.refresh').addClass('spin');
		var text = that.find('span').html();
		that.find('span').html('Loading...');
		api('HyperPin.Sync', {}, function(err, result) {
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				that.removeAttr('disabled');
				that.find('.icon.refresh').removeClass('spin');
				that.find('span').html(text);
				updateTables(result.rows);
			}
		});
	});
});

function updateTables(rows) {
	if (rows.length > 0) {
		var $tbody = $('.admin #tables tbody');
		$tbody.empty();
		for (var i = 0; i < rows.length; i++) {
			var tr = '<tr data-id=' + rows[i].key + '><td>' + rows[i].hpid + '</td><td>';
			if (rows[i].media_video) {
				tr += '<span class="badge badge-success">V</span>'
			} else {
				tr += '<span class="badge badge-important">V</span>'
			}

			tr += '</td><td>';
			if (rows[i].type != 'OG' && rows[i].platform == 'VP' && rows[i].rom === null) {
				tr += '[---]';
			} else {
				tr += 'X';
			}

			tr += '</td></tr>';
			$(tr).appendTo($tbody);
		}
		$('.admin .tables').slideDown(500);
		$('.admin .tables-placeholder').fadeOut(500);

		// enable boxes
		['#dlrom', '#dlmedia', '#fetchhs'].forEach(function(id) {
			$(id).removeClass('disabled').find('button').removeAttr('disabled');
		});

	} else {
		$('.admin .tables').hide();
		$('.admin .tables-placeholder').show();

		// disable boxes
		['#dlrom', '#dlmedia', '#fetchhs'].forEach(function(id) {
			$(id).addClass('disabled').find('button').attr('disabled', 'disabled');
		});
	}
}

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