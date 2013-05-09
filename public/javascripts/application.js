$(document).ready(function() {
	updateColumnSize();


	$(window).resize(function() {
		//resize just happened, pixels changed
		updateColumnSize();
	});

	// modal boxes
	$('.modal-form-errors').modal({ show : false, keyboard : true, backdrop : true});
	$('.modal .modal-footer a.cancel').click(function(event) {
		event.preventDefault();
		$(this).parents('.modal').modal('hide');
	})

});


function updateColumnSize() {
	// adjust the span of various columns to match the screen size
	// all adjustments are pulled from the HTML attributes
	//
	// inital
	var docWidth = $(document).width();

	//first save the default value
	$(".span1, .span2, .span3, .span4, .span5, .span6, .span7, .span8, .span9, .span10, .span11, .span12").not("div[tb-d], li[tb-d]").each(function(index) {
		$(this).attr("tb-d", $(this).attr("class"));
	});

	if (docWidth >= 1200) {
		$("div[tb-g-1200], li[tb-g-1200]").each(function(index) {
			$(this).removeClass("span1 span2 span3 span4 span5 span6 span7 span8 span9 span10 span11 span12 hide").addClass($(this).attr("tb-g-1200"));
		});
		console.log('>=1200');
	} else if (docWidth >= 980) {
		$("div[tb-d], li[tb-d]").each(function(index) {
			$(this).removeClass("span1 span2 span3 span4 span5 span6 span7 span8 span9 span10 span11 span12 hide").addClass($(this).attr("tb-d"));
		});
		console.log('>=980');
	} else if (docWidth >= 768) {
		$("div[tb-768-980], li[tb-768-980]").each(function(index) {
			$(this).removeClass("span1 span2 span3 span4 span5 span6 span7 span8 span9 span10 span11 span12 hide").addClass($(this).attr("tb-768-980"));
		});
		console.log('>=768');
	}
}

function modalAlert(type, message) {
	var $alert = $('<div class="alert alert-' + type + '" style="display:none"><button class="button close" data-dismiss="alert">×</button><p>' + message + '</p></div>');
	$('section.alerts').append($alert);
	$alert.slideDown(200);
}

function menu(c) {
	$('.mainmenu ul.nav li').removeClass('active');
	$('.mainmenu ul.nav li.' + c).addClass('active');
}

function submenu(c) {
	$('ul.submenu li').removeClass('active');
	$('ul.submenu li.' + c).addClass('active');
}

function groupdigit(nStr){
	nStr += '';
	var x = nStr.split('.');
	var x1 = x[0];
	var x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

var pindAppModule = angular.module('pind', []);

pindAppModule.directive('resource', function() {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			scope.resource = attrs['resource'];
		}
	}
});

pindAppModule.directive('pager', function() {
	return {
		restrict: 'E',
		template:
			'<div class="pagination pagination-small pull-right">' +
				'<ul>' +
					'<li class="first disabled"><a><i class="icon arrow-left"></i></a></li>' +
					'<li class="current"><a>1</a></li>' +
					'<li class="last disabled"><a><i class="icon arrow-right"></i></a></li>' +
				'</ul>' +
			'</div>',
		replace: true,
		link: function(scope, element, attrs) {

			var render = function() {
				var page = scope.$eval(attrs.page);
				var pages = scope.$eval(attrs.pages);

				console.log('rendering %d/%d', page, pages);

				element.find('li:not(.first):not(.last)').remove();
				var lastSkipped = false;
				for (var i = pages; i > 0; i--) {

					// on large number of pages, don't render all the pagination bar
					if (pages > 9 && ((i > 2 && i < (page - 1)) || (i > (page + 1) && i < (pages - 1)))) {
						if (!lastSkipped) {
							element.find('li.first').after($('<li class="spacer"></li>'));
						}
						lastSkipped = true;
						continue;
					}
					lastSkipped = false;

					var li = $('<li class="p' + i + (page == i ? ' current' : '') + '"><a href="#">' + i + '</a>');
					if (page != i) {
						li.find('a').click(function(event) {
							event.preventDefault();
							scope.$apply(attrs.page + ' = ' + parseInt($(this).html()));
						});
					} else {
						li.find('a').click(function(event) {
							event.preventDefault();
						});
					}
					// insert into dom
					element.find('li.first').after(li);
				}
				element.find('li').removeClass('disabled');
				if (page == 1) {
					element.find('li.first').addClass('disabled');
				}
				if (page == pages || pages == 0) {
					element.find('li.last').addClass('disabled');
				}

				// enable prev/next buttons
				element.find('li.first a').off('click').click(function(event) {
					event.preventDefault();
					if (page > 1) {
						scope.$apply(attrs.page + ' = ' + attrs.page + ' - 1');
					}
				});
				element.find('li.last a').off('click').click(function(event) {
					event.preventDefault();
					if (page < pages) {
						scope.$apply(attrs.page + ' = ' + attrs.page + ' + 1');
					}
				});
			}
			scope.$on('dataRefreshed', render);
		}
	}
});

pindAppModule.factory('Jsonrpc', function($http) {

	return {

		call: function(method, params, callback) {
			$http({
				url: '/api',
				method: 'POST',
				headers: {
					'Content-Type' : 'application/json'
				},
				data: JSON.stringify({ jsonrpc: '2.0', id: Math.random(), method: method, params: params})

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
					alert(data.error);
				}
			});
		}
	};
});