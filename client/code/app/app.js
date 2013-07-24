$("a[rel=popover]").popover();
$("a[rel=tooltipRight]").tooltip({placement: "right"});
$("a[rel=tooltip]").tooltip();

ss.server.on('disconnect', function() {
	console.log('Connection down :-(');
});

ss.server.on('reconnect', function() {
	console.log('Connection back up :-)');
});


updateColumnSize();

$.cookie.json = true;

$(window).resize(function() {
	//resize just happened, pixels changed
	updateColumnSize();
});

// modal boxes
$('.modal-form-errors').modal({ show : false, keyboard : true, backdrop : true});
$('.modal .modal-footer a.cancel').click(function(event) {
	event.preventDefault();
	$(this).parents('.modal').modal('hide');
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

jQuery.fn.sdclick = function(single_click_callback, double_click_callback, timeout) {
	return this.each(function(){
		var clicks = 0, self = this;
		jQuery(this).click(function(event){
			event.preventDefault();
			clicks++;
			if (clicks == 1) {
				setTimeout(function(){
					if(clicks == 1) {
						single_click_callback.call(self, event);
					} else {
						double_click_callback.call(self, event);
					}
					clicks = 0;
				}, timeout || 200);
			}
		});
	});
};