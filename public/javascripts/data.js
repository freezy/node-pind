/**
 * Sets up data for a container
 * 
 * Configuration object contains the following keys:
 * <ul><li><tt>id</tt> - class of the wrapping container</li>
 *     <li><tt>body</tt> - selector where the data is attached to</li>
 *     <li><tt>renderRows</tt> - function that renders received data</li>
 *     <li><tt>apiCall</tt> - name of the api call</li>
 *
 * @param config configuration object (see above).
 */
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

	// enable search box
	var keyTimer;
	$('.data.' + config.id + ' input.search').keyup(function() {
		var query = $(this).val();
		if (query.length != 1) {
			window.clearTimeout(keyTimer);
			keyTimer = setTimeout(function() {
				// clear sort
				$('.data.' + config.id + ' ul.sort li').removeClass('current');
				$('.pagination ul').data('page', 1);
				refreshData(config);
			}, 300);
		}
	});

	// enable filters
	$('.data.' + config.id + ' ul.filter li a').click(function(event) {
		event.preventDefault();
		$(this).parents('li').toggleClass('active');
		$('.pagination ul').data('page', 1);
		refreshData(config);
	});

	// enable sort field
	$('.data.' + config.id + ' ul.sort li a').click(function(event) {
		event.preventDefault();
		$(this).parents('ul').find('li').removeClass('current');
		$(this).parents('li').addClass('current');
		$('.pagination ul').data('page', 1);
		$(this).blur();
		refreshData(config);
	});

	// enable clear filters button
	var clearFilters = function() {
		$('.data.' + config.id + ' ul.filter li.active').removeClass('active');
		$('.data.' + config.id + ' .pagination ul').data('page', 1);
		$('.data.' + config.id + ' input.search').val('');
		refreshData(config);
	}
	$('.data.' + config.id + ' .noresult button').click(clearFilters);
}

/**
 * Refreshes data with current options.
 * @param config Data configuration.
 */
function refreshData(config) {
	var search = $('.data.' + config.id + ' input.search').val();
	var limit = $('.data.' + config.id + ' select.numrows').val();
	var offset = ($('.data.' + config.id + ' .pagination ul').data('page') - 1) * limit;
	var filters = [];
	var sort = $('.data.' + config.id + ' ul.sort li.current').data('sort');

	$('.data.' + config.id + ' ul.filter li.active').each(function() {
		filters.push($(this).data('filter'));
	});

	var params = { limit: limit, offset: offset };
	if (filters) {
		params.filters = filters;
	}
	if (search && search.length != 1) {
		params.search = search;
	}
	if (sort) {
		params.order = sort;
	}

	// fetch tables
	api(config.apiCall, params, function(err, result) {
		if (err) {
			alert('Problem: ' + err);
		} else {
			updateData(config, result);
		}
	});
}

/**
 * Updates UI for a given response.
 * @param config Data configuration.
 * @param response Response from server
 */
function updateData(config, response) {

	// retrieve variables
	var numrows = $('.data.' + config.id + ' select.numrows').val();
	var pager = $('.data.' + config.id + ' .pagination');
	var pages = Math.ceil(response.count / numrows);
	var page = pager.find('ul').data('page');
	var resultsFiltered = $('.data.' + config.id + ' ul.filter li.active').length > 0;
	var searchQuery = $('.data.' + config.id + ' input.search').val();

	// update pagination
	pager.find('li:not(.first):not(.last)').remove();
	var lastSkipped = false;
	for (var i = pages; i > 0; i--) {

		// on large number of pages, don't render all the pagination bar
		if (pages > 9 && ((i > 2 && i < (page - 1)) || (i > (page + 1) && i < (pages - 1)))) {
			if (!lastSkipped) {
				pager.find('li.first').after($('<li class="spacer"></li>'));
			}
			lastSkipped = true;
			continue;
		}
		lastSkipped = false;

		var li = $('<li class="p' + i + (page == i ? ' current' : '') + '"><a href="#">' + i + '</a>');
		if (page != i) {
			li.find('a').click(function(event) {
				event.preventDefault();
				$(this).parents('ul').data('page', parseInt($(this).html()));
				refreshData(config);
			});
		} else {
			li.find('a').click(function(event) {
				event.preventDefault();
			});
		}
		// insert into dom
		pager.find('li.first').after(li);
	}
	pager.find('li').removeClass('disabled');
	if (page == 1) {
		pager.find('li.first').addClass('disabled');
	}
	if (page == pages || pages == 0) {
		pager.find('li.last').addClass('disabled');
	}

	// results returned
	if (response.rows && response.rows.length > 0) {

		// run callback
		config.renderRows($('.data.' + config.id + ' ' + config.body), response.rows);

		$('.data.' + config.id).show();
		$('.data.' + config.id + ' .wrapper').slideDown(500);
		$('.data.' + config.id + ' + div.empty').fadeOut(200);
		$('.data.' + config.id + ' .noresult').fadeOut(200);

	// no results due to filtering
	} else if (resultsFiltered || (searchQuery && searchQuery.length > 1)) {

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

/**
 * Calls the pind JSON-RPC API.
 * @param method Namespace and name of the method ("Namespace.Method")
 * @param params Parameters as object
 * @param callback callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} Result</li></ol>
 */
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
		} else if (ret.result.error) {
			callback(typeof ret.result.error.message === 'object' ? JSON.stringify(ret.result.error.message) : ret.result.error.message, ret.result.error);
		} else {
			callback(null, ret.result);
		}
	}).fail(function(xhr, status, error) {
		if (xhr.status == 401) {
			window.location = $('head meta[name="login"]').attr('content');

		} else {
			alert(error);
		}
	});
}

function ngApi($http, method, params, callback) {
	$http({
		url: '/api',
		method: 'POST',
		headers: {
			'Content-Type' : 'application/json'
		},
		data: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params})
	}).success(function(ret) {
		if (ret.error) {
			callback(ret.error.message, ret.error);
		} else if (ret.result.error) {
			callback(typeof ret.result.error.message === 'object' ? JSON.stringify(ret.result.error.message) : ret.result.error.message, ret.result.error);
		} else {
			callback(null, ret.result);
		}
	}).error(function(data) {
		if (data.status == 401) {
			window.location = $('head meta[name="login"]').attr('content');
		} else {
			alert(error);
		}
	});
}
