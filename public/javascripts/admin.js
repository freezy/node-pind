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
	var syncHyperPin = function() {
		var labels = [];
		[$('.admin .tables-placeholder button'), $('#hpsync button')].forEach(function(btn) {
			labels.push(btn.find('span').html());
			btn.attr('disabled', 'disabled');
			btn.find('.icon.refresh').addClass('spin');
			btn.find('span').html('Syncing...');
		});

		api('HyperPin.Sync', {}, function(err, result) {
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				[$('.admin .tables-placeholder button'), $('#hpsync button')].forEach(function(btn) {
					btn.removeAttr('disabled');
					btn.find('.icon.refresh').removeClass('spin');
					btn.find('span').html(labels.shift());
				});
				updateTables(result.rows);
			}
		});
	};

	$('.admin .tables-placeholder button').click(syncHyperPin);
	$('#hpsync button').click(syncHyperPin);

});

function updateTables(rows) {
	if (rows.length > 0) {
		var $tbody = $('.admin #tables tbody');
		$tbody.empty();
		for (var i = 0; i < rows.length; i++) {
			// TODO implement proper pagination
			//if (i == 10) { break; }
			var tr = '<tr data-id=' + rows[i].key + '><td>' + rows[i].hpid + '</td>';

			var ul = function(tag, icon, hint) {
				return '<li class="badge' + (tag ? ' badge-' + tag : '') + '" title="' + hint + '"><i class="icon ' + icon + '"></i></li>';
			}

			tr += '<td><ul class="badge-group">';
			tr += ul(rows[i].table_file ? 'success' : 'important', 'file', 'Table File');
			tr += ul(rows[i].rom_file ? 'success' : rows[i].rom_file === null ? null : 'important', 'chip', 'ROM File');
			tr += '</ul></td>';

			tr += '<td><ul class="badge-group">';
			tr += ul(rows[i].media_wheel ? 'success' : 'important', 'logo', 'Wheel Image');
			tr += ul(rows[i].media_backglass ? 'success' : 'important', 'ipad', 'Backglass Image');
			tr += ul(rows[i].media_table ? 'success' : 'important', 'camera', 'Table Image');
			tr += ul(rows[i].media_video ? 'success' : 'important', 'video', 'Table Video');

			tr += '</ul></td><td>';
			if (rows[i].type != 'OG' && rows[i].platform == 'VP' && rows[i].rom === null) {
				tr += '[---]';
			} else {
				if (rows[i].rom) {
					tr += rows[i].rom;
				} else {
					tr += 'X';
				}

			}

			tr += '</td></tr>';
			$(tr).appendTo($tbody);
		}
		$('.admin .tables').slideDown(500);
		$('.admin .tables-placeholder').fadeOut(500);

		// enable boxes
		['#dlrom', '#dlmedia', '#fetchhs', '#ipdbsync'].forEach(function(id) {
			$(id).removeClass('disabled').find('button').removeAttr('disabled');
		});

	} else {
		$('.admin .tables').hide();
		$('.admin .tables-placeholder').show();

		// disable boxes
		['#dlrom', '#dlmedia', '#fetchhs', '#ipdbsync'].forEach(function(id) {
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