$(document).ready(function() {

	$('#coinleft > button').click(function() {
		api('Control.InsertCoin', { slot: 1 }, function(err, result) {
			if (err) {
				modalAlert('error', '<strong>Oops!</strong> ' + err);
			} else {
				$('.dmd').data('credits', result.credits);
				updateCredits();
				modalAlert('success', "<strong>Success!</strong> You've just inserted a coin into the left slot, which should have given you one credit.");
			}
		});
	});
});

function updateCredits() {

	var $btn = $('.fuzzy3d > button');
	var $outer = $('.fuzzy3d');
	var $dmd = $('.dmd');

	var credits = $dmd.data('credits');

	$dmd.find('span').html('CREDITS ' + credits);
	$btn.prop('disabled', credits == 0);
}