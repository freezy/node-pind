$(document).ready(function() {

	// modal boxes
	$('.modal-form-errors').modal({ show : false, keyboard : true, backdrop : true});

});

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