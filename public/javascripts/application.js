$(document).ready(function() {

	// modal boxes
	$('.modal-form-errors').modal({ show : false, keyboard : true, backdrop : true});

});

function menu(c) {
	$('.mainmenu ul.nav li').removeClass('active');
	$('.mainmenu ul.nav li.' + c).addClass('active');
}

function submenu(c) {
	$('ul.submenu li').removeClass('active');
	$('ul.submenu li.' + c).addClass('active');
}