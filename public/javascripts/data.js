function enableData(d, renderResult) {

	// enable items/page dropdown
	$('.data.' + d + ' select.numrows').change(function() {
		$('.data.' + d + ' .pagination ul').data('page', 1);
		refreshData(d, renderResult);
	});

	// enable prev/next buttons
	$('.data.' + d + ' .pagination li.first a').click(function(event) {
		event.preventDefault();
		var $ul = $(this).parents('ul');
		var page = parseInt($ul.data('page'));
		if (page > 1) {
			$ul.data('page', page - 1);
			refreshData(d, renderResult);
		}
	});
	$('.data.' + d + ' .pagination li.last a').click(function(event) {
		event.preventDefault();
		var $ul = $(this).parents('ul');
		var page = parseInt($ul.data('page'));
		var numpages = parseInt($(this).parent().prev().find('a').html());
		if (page < numpages) {
			$ul.data('page', page + 1);
			refreshData(d, renderResult);
		}
	});

	// enable filters
	$('.data.' + d + ' ul.filter li a').click(function(event) {
		event.preventDefault();
		$(this).parents('li').toggleClass('active');
		$('.pagination ul').data('page', 1);
		refreshData(d, renderResult);
	});

	// enable clear filters button
	var clearFilters = function() {
		$('.data.' + d + ' ul.filter li.active').removeClass('active');
		$('.data.' + d + ' .pagination ul').data('page', 1);
		refreshData(d, renderResult);
	}
	$('.data.' + d + ' .noresult button').click(clearFilters);
}

function refreshData(d, renderResult) {
	var limit = $('.data.' + d + ' select.numrows').val();
	var offset = ($('.data.' + d + ' .pagination ul').data('page') - 1) * limit;
	var filters = [];

	$('.data.' + d + ' ul.filter li.active').each(function() {
		filters.push($(this).data('filter'));
	});

	// fetch tables
	api('Table.GetAll', { limit: limit, offset: offset, filters: filters }, function(err, result) {
		if (err) {
			alert('Problem: ' + err);
		} else {
			updateData(d, result, renderResult);
		}
	});
}

function updateData(d, response, renderResult) {

	// retrieve variables
	var numrows = $('.data.' + d + ' select.numrows').val();
	var pages = Math.ceil(response.count / numrows);
	var page = $('.data.' + d + ' .pagination ul').data('page');
	var resultsFiltered = $('.data.' + d + ' ul.filter li.active').length > 0;

	// update pagination
	$('.data.' + d + ' .pagination li:not(.first):not(.last)').remove();
	for (var i = pages; i > 0; i--) {
		var li = $('<li class="p' + i + (page == i ? ' current' : '') + '"><a href="#">' + i + '</a>');
		if (page != i) {
			li.find('a').click(function(event) {
				event.preventDefault();
				$(this).parents('ul').data('page', $(this).html());
				refreshData(d, renderResult);
			});
		} else {
			li.find('a').click(function(event) {
				event.preventDefault();
			});
		}
		$('.data.' + d + ' .pagination li.first').after(li);
	}
	$('.data.' + d + ' .pagination li').removeClass('disabled');
	if (page == 1) {
		$('.data.' + d + ' .pagination li.first').addClass('disabled');
	}
	if (page == pages || pages == 0) {
		$('.data.' + d + ' .pagination li.last').addClass('disabled');
	}

	// results returned
	if (response.rows && response.rows.length > 0) {

		// run callback
		renderResult($('.admin #tables tbody'), response.rows);

		$('.data.' + d).show();
		$('.data.' + d + ' .wrapper').slideDown(500);
		$('.data.' + d + ' + div.empty').fadeOut(200);
		$('.data.' + d + ' .noresult').fadeOut(200);

	// no results due to filtering
	} else if (resultsFiltered) {

		$('.data.' + d).show();
		$('.data.' + d + ' .wrapper').slideUp(200);
		$('.data.' + d + ' + div.empty').hide();
		$('.data.' + d + ' .noresult').fadeIn(500);

	// no results due to no data
	} else {

		$('.data.' + d).hide();
		$('.data.' + d + ' .wrapper').show();
		$('.data.' + d + ' + div.empty').fadeIn(500);
		$('.data.' + d + ' .noresult').hide();
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
