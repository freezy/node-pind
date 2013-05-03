$(document).ready(function() {

	var render = function($tbody, rows) {
		var ignoreTableVids = $('.data.tables table').data('ignoretablevids');
		$tbody.empty();
		for (var i = 0; i < rows.length; i++) {

			var tr;
			if (rows[i].name && rows[i].year && rows[i].manufacturer) {
				tr = '<tr data-id=' + rows[i].key + '><td>' + (rows[i].name_match ? rows[i].name_match : rows[i].name) + ' (' + rows[i].manufacturer + ' ' + rows[i].year + ')</td>';
			} else {
				tr = '<tr data-id=' + rows[i].key + '><td>' + rows[i].hpid + '</td>';
			}
			
			var ul = function(tag, icon, hint) {
				return '<li class="badge' + (tag ? ' badge-' + tag : '') + '" title="' + hint + '"><i class="icon ' + icon + '"></i></li>';
			}

			tr += '<td class="nowrap"><ul class="badge-group">';
			tr += ul(rows[i].table_file ? 'success' : 'important', 'file', 'Table File');
			tr += ul(rows[i].rom_file ? 'success' : rows[i].rom_file === null ? null : 'important', 'chip', 'ROM File');
			tr += '</ul></td>';

			tr += '<td class="nowrap"><ul class="badge-group">';
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
		processed('#hpsync');
	};

	var config = {
		id: 'tables',
		body: 'table tbody',
		renderRows: render,
		apiCall: 'Table.GetAll'
	};


	// load data on startup
	enableData(config);
	refreshData(config);

	// enable sync hyperpin button
	var syncHyperPin = function() {
		processing('#hpsync');
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
			processed('#hpsync');
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
		processing('#ipdbsync');
		var limit = $('select.numrows').val();
		var offset = ($('.pagination ul').data('page') - 1) * limit;

		api('Pind.FetchIPDB', { limit: limit, offset: offset }, function(err, result) {
			processed('#ipdbsync');
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				updateData(config, result);
			}
		});
	};

	// enable download missing roms button
	var downloadRoms = function() {
		processing('#dlrom');

		api('Pind.FetchMissingRoms', { }, function(err, result) {
			processed('#dlrom');
			if (err) {
				alert('Problem Syncing: ' + err);
			} else {
				console.log('Downloaded ROMs: ' + result.filepaths);
				refreshData(config);
			}
		});
	};

	// enable download missing media button
	var downloadMedia = function() {
		processing('#dlmedia');

		api('HyperPin.FindMissingMedia', { }, function(err) {
			processed('#dlmedia');
			if (err) {
				alert('Problem Downloading: ' + err);
			} else {
				refreshData(config);
			}
		});
	};

	// enable fetchHiscores button
	var fetchHiscores = function() {
		processing('#fetchhs');
		api('Pind.FetchHiscores', { }, function(err, result) {
			processed('#fetchhs');
			if (err) {
				alert('Problem Syncing: ' + err);
			}
		});
	};

	$('.data.tables + .empty button').click(syncHyperPin);
	$('#hpsync button').click(syncHyperPin);
	$('#ipdbsync button').click(syncIPDB);
	$('#dlrom button').click(downloadRoms);
	$('#dlmedia button').click(downloadMedia);
	$('#fetchhs button').click(fetchHiscores);

	// real time code
	var socket = io.connect('/');
	var $console = $('#console');
	var timer;
	socket.on('notice', function(notice) {
		var timeout = notice.timeout ? notice.timeout : 1500;
		if (!$console.is(':visible')) {
			$console.slideDown(200);
		}
		$('#console span').html(notice.msg);
		clearTimeout(timer);
		timer = setTimeout(function() {
			$console.slideUp(200);
		}, timeout);
	});
	socket.on('startProcessing', function(msg) {
		processing(msg.id);
	});
	socket.on('endProcessing', function(msg) {
		processed(msg.id);
	});
	socket.on('tableUpdate', function(msg) {
		if ($('tr[data-id="' + msg.key + '"]').length > 0) {
			refreshData(config);
		}
	});
});

function updateActions() {
	$('.action').removeClass('disabled').find('button').removeAttr('disabled').find('i').removeClass('spin');
	$('.action').each(function() {
		if ($(this).data('processing')) {
			$($(this).data('exclusive'))
				.addClass('disabled')
				.find('button')
				.attr('disabled', 'disabled');
			$(this).find('button').attr('disabled', 'disabled').find('i').addClass('spin');
		}
	});
}

function processing(section) {
	$(section).data('processing', true);
	updateActions();
}

function processed(section) {
	$(section).data('processing', false);
	updateActions()
}
