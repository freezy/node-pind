$(document).ready(function() {

	$('#coinleft > button').click(function() {
		api('Control.InsertCoin', { slot: 1 }, function(err, result) {
			if (err) {
				alert('Problem: ' + err);
			} else {
				var $alert = $('.alert').addClass('alert-success');
				$alert.find('p').html("<strong>Success!</strong> You've just inserted a coin into the left slot, which should have given you one credit.");
				$alert.fadeIn(200);
			}
		});
	});

});
