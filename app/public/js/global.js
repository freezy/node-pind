$(document).ready(function() {


	// rotate blood stains
/*	var total = 12;
	$('.modal-header').each(function() {
		var randNum = Math.floor((Math.random()*total)+1);
		var m = randNum > 9 ? randNum : '0' + randNum;
		$(this).css('background-image', $(this).css('background-image').replace(/(\d)+/, m));
	});
*/

	// side bar
	$('.sidenav').affix({
		offset: {
			top: $('.navbar').height() + parseInt($('.navbar').css('margin-bottom'))
		}
	});

});