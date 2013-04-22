$(document).ready(function() {
	updateColumnSize();


	$(window).resize(function() {
		//resize just happened, pixels changed
		updateColumnSize();
	});

	// modal boxes
	$('.modal-form-errors').modal({ show : false, keyboard : true, backdrop : true});

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
	$alert = $('<div class="alert alert-' + type + '" style="display:none"><button class="button close" data-dismiss="alert">×</button><p>' + message + '</p></div>');
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