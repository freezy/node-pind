$(document).ready(function() {

	var render = function($tbody, rows) {

		$tbody.empty();
		for (var i = 0; i < rows.length; i++) {

			var tr = '<tr data-id=' + rows[i].key + '><td>' + rows[i].user + '</td>';
			tr += '<td>' + rows[i].credits + '</td>';
			tr += '</td></tr>';
			$(tr).appendTo($tbody);
		}
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
