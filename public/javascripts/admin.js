$(document).ready(function() {

	var renderTables = function($tbody, rows) {

		var ignoreTableVids = $tbody.parents('table').data('ignoreTableVids');
		$tbody.empty();
		for (var i = 0; i < rows.length; i++) {

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
			if (!ignoreTableVids) {
				tr += ul(rows[i].media_video ? 'success' : 'important', 'video', 'Table Video');
			}

			tr += '</ul></td>';
			if (rows[i].type != 'OG' && rows[i].platform == 'VP' && rows[i].rom === null) {
				if (rows[i].table_file) {
					tr += '<td class="rom missing">missing';
				} else {
					tr += '<td class="rom unknown">(unknown)';
				}
			} else {
				if (rows[i].rom) {
					tr += '<td class="rom">' + rows[i].rom;
				} else {
					tr += '<td class="rom na">(n/a)';
				}

			}

			tr += '</td></tr>';
			$(tr).appendTo($tbody);
		}

		// enable boxes
		fetched();
	};

	var config = {
		dataId: 'tables',
		renderRows: renderTables,
		apiCall: 'Table.GetAll'
	};


	// load data on startup
	enableData(config);
	refreshData(config);

	// enable sync hyperpin button
	var syncHyperPin = function() {
		fetching('#hpsync');
		var labels = [];
		[$('.data.tables + .empty button'), $('#hpsync button')].forEach(function(btn) {
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
				[$('.data.tables + .empty button'), $('#hpsync button')].forEach(function(btn) {
					btn.removeAttr('disabled');
					btn.find('.icon.refresh').removeClass('spin');
					btn.find('span').html(labels.shift());
				});
				updateData(config, result);
			}
		});
	};

	// enable sync ipdb button
	var syncIPDB = function() {
		fetching('#ipdbsync');
		var limit = $('select.numrows').val();
		var offset = ($('.pagination ul').data('page') - 1) * limit;

		api('HyperPin.FetchIPDB', { limit: limit, offset: offset }, function(err, result) {
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				updateData(config, result);
			}
		});		
	};

	$('.data.tables + .empty button').click(syncHyperPin);
	$('#hpsync button').click(syncHyperPin);
	$('#ipdbsync button').click(syncIPDB);

});

function fetching(skip) {
	['#hpsync', '#dlrom', '#dlmedia', '#fetchhs', '#ipdbsync'].forEach(function(id) {
		if (id != skip) {
			$(id).addClass('disabled').find('button').attr('disabled', 'disabled');
		}
	});
}

function fetched() {
	['#hpsync', '#dlrom', '#dlmedia', '#fetchhs', '#ipdbsync'].forEach(function(id) {
		$(id).removeClass('disabled').find('button').removeAttr('disabled');
	});
}

