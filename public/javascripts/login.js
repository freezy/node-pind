$(document).ready(function() {

	$('input[name="user"]').focus();

	// bind event listeners to button clicks
	$('#login-form #forgot-password').click(function() {
		$('#get-credentials').modal('show');
	});

	// automatically toggle focus between the email modal window and the login form
	$('#get-credentials').on('shown', function() {
		$('#email-tf').focus();
	});
	$('#get-credentials').on('hidden', function() {
		$('#user-tf').focus();
	});


	// login retrieval form via email
	var ev = new EmailValidator();

	$('#get-credentials-form').ajaxForm({
		url : '/lost-password',
		beforeSubmit : function(formData, jqForm, options) {
			if (ev.validateEmail($('#email-tf').val())) {
				ev.hideEmailAlert();
				return true;
			} else {
				ev.showEmailAlert("<b> Error!</b> Please enter a valid email address.");
				return false;
			}
		},
		success : function(responseText, status, xhr, $form) {
			ev.showEmailSuccess("Check your email on how to reset your password.");
		},
		error : function() {
			ev.showEmailAlert("Sorry. There was a problem, please try again later.");
		}
	});

});


function EmailValidator() {

	// bind this to _local for anonymous functions //
	var _local = this;

	// modal window to allow users to request credentials by email //
	_local.retrievePassword = $('#get-credentials');
	_local.retrievePassword.modal({ show : false, keyboard : true, backdrop : true });
	_local.retrievePasswordAlert = $('#get-credentials .alert');
	_local.retrievePassword.on('show', function() {
		$('#get-credentials-form').resetForm();
		_local.retrievePasswordAlert.hide();
	});

}

EmailValidator.prototype.validateEmail = function(e) {
	var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return re.test(e);
}

EmailValidator.prototype.showEmailAlert = function(m) {
	this.retrievePasswordAlert.attr('class', 'alert alert-error');
	this.retrievePasswordAlert.html(m);
	this.retrievePasswordAlert.show();
}

EmailValidator.prototype.hideEmailAlert = function() {
	this.retrievePasswordAlert.hide();
}

EmailValidator.prototype.showEmailSuccess = function(m) {
	this.retrievePasswordAlert.attr('class', 'alert alert-success');
	this.retrievePasswordAlert.html(m);
	this.retrievePasswordAlert.fadeIn(500);
}