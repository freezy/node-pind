$(document).ready(function() {

	var render = function($tbody, rows) {

		$tbody.empty();

		var tdCredits = function(credits) {
			return '<i class="icon pencil clickable"></i> ' + credits;
		}

		for (var i = 0; i < rows.length; i++) {
			var tr = '<tr data-id="' + rows[i].id + '"><td>' + rows[i].user + '</td>';
			tr += '<td data-value="' + rows[i].credits + '" class="nowrap">' + tdCredits(rows[i].credits) + '</td>';
			tr += '</td></tr>';
			$(tr).appendTo($tbody);
		}

		var onCreditSave = function(event) {
			var $td = $(event.currentTarget).parents('td');
			api('User.Update', { id: $td.parents('tr').data('id'), credits: $td.find('input').val() }, function(err, result) {
				if (err) {
				} else {
					$td.html(tdCredits(result.credits));
					$td.data('value', result.credits);
				}
			});
			$td.find('.icon.remove').unbind('click');
			$td.find('.icon.ok').unbind('click');
			$td.find('input').prop('disabled', true);
		}

		var onCreditCancel = function(event) {
			var $td = $(event.currentTarget).parents('td');
			$td.html(tdCredits($td.data('value')));
		}

		// setup click events
		$(document).on('click', '.icon.remove', onCreditCancel);
		$(document).on('click', '.icon.ok', onCreditSave);
		$(document).on('click', '.icon.pencil', function(event) {
			var id = $(event.currentTarget).parents('tr').data('id');
			var $td = $(event.currentTarget).parents('td');
			var value = $td.data('value');
			$td.html(
				'<i class="icon remove clickable"></i>' +
					'<input type="text" value="' + value + '" class="input-micro" />' +
					'<i class="icon ok clickable"></i> '
			);

			// enable enter and esc while typing
			$td.find('input').focus().on('keyup', function(e) {
				if (e.which == 13) {
					onCreditSave(e);
				}
				if (e.which == 27) {
					onCreditCancel(e);
				}
			});
		});
	};

	var config = {
		id: 'users',
		renderRows: render,
		apiCall: 'User.GetAll'
	};

	// load data on startup
	enableData(config);
	refreshData(config);
});
