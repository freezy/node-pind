$(document).ready(function() {

	var render = function($parent, rows) {
		$parent.empty();
		for (var i = 0; i < rows.length; i++) {

			var row = rows[i];
			var imgUrl = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&full=1&id=' + row.fileId;

			$parent.append($('<li class="span6 vpf item" data-id="' + row.fileId + '"><div class="thumbnail">' +
				'<div class="pull-left"><a href="' + imgUrl + '" class="fancybox">' +
//					'<div class="thumb"></div>' +
					'<div class="thumb" style="background-image: url(\'' + imgUrl + '\')"></div>' +
					'<div class="thumb-placeholder"></div>' +
				'</a></div>' +
				'<h3>' + row.title_trimmed + '</h3>' +
				'<h4>' + row.info + '</h4>' +
			'</div></li>'	));
		}

		$parent.find('.thumb').waitForImages({
			each: function(img) {
				$(this).addClass('loaded');
			},
			waitForAll: true
		});
		$parent.find('a').fancybox();
	}

	var config = {
		id: 'vpf.tables',
		body: 'ul.thumbnails',
		renderRows: render,
		apiCall: 'VPForums.FindTables'
	};

	// load data on startup
	enableData(config);
	refreshData(config);
});
