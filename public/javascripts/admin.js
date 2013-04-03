$(document).ready(function() {

	// load data on startup
	refreshTables();

	// enable items/page dropdown
	$('select.numrows').change(function() {
		$('.pagination ul').data('page', 1);
		refreshTables();
	});

	// enable prev/next buttons
	$('.pagination li.first a').click(function(event) {
		event.preventDefault();
		var $ul = $(this).parents('ul');
		var page = parseInt($ul.data('page'));
		if (page > 1) {
			$ul.data('page', page - 1);
			refreshTables();
		}
	});
	$('.pagination li.last a').click(function(event) {
		event.preventDefault();
		var $ul = $(this).parents('ul');
		var page = parseInt($ul.data('page'));
		var numpages = parseInt($(this).parent().prev().find('a').html());
		if (page < numpages) {
			$ul.data('page', page + 1);
			refreshTables();
		}
	});

	// enable reload button
	var syncHyperPin = function() {
		fetching();
		var labels = [];
		[$('.admin .tables-placeholder button'), $('#hpsync button')].forEach(function(btn) {
			labels.push(btn.find('span').html());
			btn.attr('disabled', 'disabled');
			btn.find('.icon.refresh').addClass('spin');
			btn.find('span').html('Syncing...');
		});

		var limit = $('select.numrows').val();
		var offset = ($('.pagination ul').data('page') - 1) * limit;

		api('HyperPin.Sync', { limit: limit, offset: offset }, function(err, result) {
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				[$('.admin .tables-placeholder button'), $('#hpsync button')].forEach(function(btn) {
					btn.removeAttr('disabled');
					btn.find('.icon.refresh').removeClass('spin');
					btn.find('span').html(labels.shift());
				});
				updateTables(result);
			}
		});
	};

	$('.admin .tables-placeholder button').click(syncHyperPin);
	$('#hpsync button').click(syncHyperPin);

	// enable filters
	$('ul.filter li a').click(function(event) {
		event.preventDefault();
		$(this).parents('li').toggleClass('active');
		refreshTables();
	});
});

function refreshTables() {
	var limit = $('select.numrows').val();
	var offset = ($('.pagination ul').data('page') - 1) * limit;
	var filters = [];

	$('ul.filter li.active').each(function() {
		filters.push($(this).data('filter'));
	});

	// fetch tables
	api('Table.GetAll', { limit: limit, offset: offset, filters: filters }, function(err, result) {
		if (err) {
			alert('Problem: ' + err);
		} else {
			updateTables(result);
		}
	});
}

function updateTables(response) {
	var numrows = $('select.numrows').val();
	var pages = Math.ceil(response.count / numrows);
	var page = $('.pagination ul').data('page');

	// update pagination
	$('.pagination li:not(.first):not(.last)').remove();
	for (var i = pages; i > 0; i--) {
		var li = $('<li class="p' + i + (page == i ? ' current' : '') + '"><a href="#">' + i + '</a>');
		if (page != i) {
			li.find('a').click(function(event) {
				event.preventDefault();
				$(this).parents('ul').data('page', $(this).html());
				refreshTables();
			});
		} else {
			li.find('a').click(function(event) {
				event.preventDefault();
			});
		}
		$('.pagination li.first').after(li);
	}
	$('.pagination li').removeClass('disabled');
	if (page == 1) {
		$('.pagination li.first').addClass('disabled');
	}
	if (page == pages) {
		$('.pagination li.last').addClass('disabled');
	}

	var rows = response.rows;
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
		fetched();

	} else {
		$('.admin .tables').hide();
		$('.admin .tables-placeholder').show();

		// disable boxes
		fetching();
	}
}

function fetching() {
	['#dlrom', '#dlmedia', '#fetchhs', '#ipdbsync'].forEach(function(id) {
		$(id).addClass('disabled').find('button').attr('disabled', 'disabled');
	});
}

function fetched() {
	['#dlrom', '#dlmedia', '#fetchhs', '#ipdbsync'].forEach(function(id) {
		$(id).removeClass('disabled').find('button').removeAttr('disabled');
	});
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