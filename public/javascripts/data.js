function enableData(config) {
	
	if (!config.id) {
		throw new Error('Must provide data ID when enabling data.');
	}
	if (!config.renderRows) {
		throw new Error('Must provide render function when enabling data.');
	}
	if (!config.apiCall) {
		throw new Error('Must provide API call when enabling data.');
	}

	// enable items/page dropdown
	$('.data.' + config.renderResult + ' select.numrows').change(function() {
		$('.data.' + config.id + ' .pagination ul').data('page', 1);
		refreshData(config);
	});

	// enable prev/next buttons
	$('.data.' + config.id + ' .pagination li.first a').click(function(event) {
		event.preventDefault();
		var $ul = $(this).parents('ul');
		var page = parseInt($ul.data('page'));
		if (page > 1) {
			$ul.data('page', page - 1);
			refreshData(config);
		}
	});
	$('.data.' + config.id + ' .pagination li.last a').click(function(event) {
		event.preventDefault();
		var $ul = $(this).parents('ul');
		var page = parseInt($ul.data('page'));
		var numpages = parseInt($(this).parent().prev().find('a').html());
		if (page < numpages) {
			$ul.data('page', page + 1);
			refreshData(config);
		}
	});

	// enable filters
	$('.data.' + config.id + ' ul.filter li a').click(function(event) {
		event.preventDefault();
		$(this).parents('li').toggleClass('active');
		$('.pagination ul').data('page', 1);
		refreshData(config);
	});

	// enable clear filters button
	var clearFilters = function() {
		$('.data.' + config.id + ' ul.filter li.active').removeClass('active');
		$('.data.' + config.id + ' .pagination ul').data('page', 1);
		refreshData(config);
	}
	$('.data.' + config.id + ' .noresult button').click(clearFilters);
}

function refreshData(config) {
	var limit = $('.data.' + config.id + ' select.numrows').val();
	var offset = ($('.data.' + config.id + ' .pagination ul').data('page') - 1) * limit;
	var filters = [];

	$('.data.' + config.id + ' ul.filter li.active').each(function() {
		filters.push($(this).data('filter'));
	});

	// fetch tables
	api(config.apiCall, { limit: limit, offset: offset, filters: filters }, function(err, result) {
		if (err) {
			alert('Problem: ' + err);
		} else {
			updateData(config, result);
		}
	});
}

function updateData(config, response) {

	// retrieve variables
	var numrows = $('.data.' + config.id + ' select.numrows').val();
	var pages = Math.ceil(response.count / numrows);
	var page = $('.data.' + config.id + ' .pagination ul').data('page');
	var resultsFiltered = $('.data.' + config.id + ' ul.filter li.active').length > 0;

	// update pagination
	$('.data.' + config.id + ' .pagination li:not(.first):not(.last)').remove();
	for (var i = pages; i > 0; i--) {
		var li = $('<li class="p' + i + (page == i ? ' current' : '') + '"><a href="#">' + i + '</a>');
		if (page != i) {
			li.find('a').click(function(event) {
				event.preventDefault();
				$(this).parents('ul').data('page', $(this).html());
				refreshData(config);
			});
		} else {
			li.find('a').click(function(event) {
				event.preventDefault();
			});
		}
		$('.data.' + config.id + ' .pagination li.first').after(li);
	}
	$('.data.' + config.id + ' .pagination li').removeClass('disabled');
	if (page == 1) {
		$('.data.' + config.id + ' .pagination li.first').addClass('disabled');
	}
	if (page == pages || pages == 0) {
		$('.data.' + config.id + ' .pagination li.last').addClass('disabled');
	}

	// results returned
	if (response.rows && response.rows.length > 0) {

		// run callback
		config.renderRows($('.data.' + config.id + ' table tbody'), response.rows);

		$('.data.' + config.id).show();
		$('.data.' + config.id + ' .wrapper').slideDown(500);
		$('.data.' + config.id + ' + div.empty').fadeOut(200);
		$('.data.' + config.id + ' .noresult').fadeOut(200);

	// no results due to filtering
	} else if (resultsFiltered) {

		$('.data.' + config.id).show();
		$('.data.' + config.id + ' .wrapper').slideUp(200);
		$('.data.' + config.id + ' + div.empty').hide();
		$('.data.' + config.id + ' .noresult').fadeIn(500);

	// no results due to no data
	} else {

		$('.data.' + config.id).hide();
		$('.data.' + config.id + ' .wrapper').show();
		$('.data.' + config.id + ' + div.empty').fadeIn(500);
		$('.data.' + config.id + ' .noresult').hide();
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