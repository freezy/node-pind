$(document).ready(function() {

	var lv = new LoginValidator();
	var lc = new LoginController();

	// main login form
	$('#login-form').ajaxForm({
		beforeSubmit : function(formData, jqForm, options) {
			if (lv.validateForm() == false) {
				return false;
			} else {
				// append 'remember-me' option to formData to write local cookie //
				formData.push({name : 'remember-me', value : $('#remember-me-checkbox').length == 1})
				return true;
			}
		},
		success : function(responseText, status, xhr, $form) {
			if (status == 'success') window.location.href = '/home';
		},
		error : function(e) {
			lv.showLoginError('Login Failure', 'Please check your username and/or password.');
		}
	});
	$('input[name="user"]').focus();


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

function LoginController() {

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

}

function LoginValidator() {

	// bind a simple alert window to this controller to display any errors
	this.loginErrors = $('.modal-alert');
	this.loginErrors.modal({ show : false, keyboard : true, backdrop : true });

	this.showLoginError = function(t, m) {
		$('.modal-alert .modal-header h3').text(t);
		$('.modal-alert .modal-body p').text(m);
		this.loginErrors.modal('show');
	}
}

LoginValidator.prototype.validateForm = function() {
	if ($('#user-tf').val() == '') {
		this.showLoginError('Whoops!', 'Please enter a valid username');
		return false;
	} else if ($('#pass-tf').val() == '') {
		this.showLoginError('Whoops!', 'Please enter a valid password');
		return false;
	} else {
		return true;
	}
}