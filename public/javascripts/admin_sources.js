$(document).ready(function() {

	api('VPForums.FindTables', { }, function(err, result) {
		if (err) {
			alert(err);
		} else {
			var $parent = $('.data.vpf.tables .wrapper');
			for (var i = 0; i < result.rows.length; i++) {

				var row = result.rows[i];
				var imgUrl = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&full=1&id=' + row.fileId;

				$parent.append($('<div class="vpf item" data-id="' + row.fileId + '">' +
//					'<div class="thumb"></div>' +
					'<div class="thumb" style="background-image: url(\'' + imgUrl + '\')"></div>' +
					'<div class="thumb-placeholder"></div>' +
					'<div class="box">' +
						'<h3>' + row.title + '</h3>' +
					'</div>' +
				'</div>'));
			}
			console.log('content added, enabling fades...');

			$parent.find('.thumb').waitForImages({
				each: function(img) {
					console.log('Loaded: ' + img);
					$(this).addClass('loaded');
				},
				finished: function() {
					console.log('All images loaded.');
				},
				waitForAll: true
			});
		}
	});
});
