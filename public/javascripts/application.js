$(document).ready(function() {

	// modal boxes
	$('.modal-form-errors').modal({ show : false, keyboard : true, backdrop : true});

});

function menu(id) {
	$('.navbar-inner ul.nav li').removeClass('active');
	$('#' + id).parents('li').addClass('active');
}