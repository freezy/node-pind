$(document).ready(function() {

	var addTransfer = function(event) {
		event.preventDefault();
		var row = $(this).parents('li.item').data('row');

		var $dialog = $('.modal.download-table');
		$dialog.find('.modal-header img').attr('src', row.imgUrlSmall);
		$dialog.find('.modal-header h2 span').html(row.title);
		$dialog.modal('show');
		$dialog.find('.modal-footer button.download').click(function() {
			var params = { id: row.id };
			$.each($dialog.find('.modal-body form').serializeArray(), function(idx, checkbox) {
				console.log('%j', checkbox);
				params[checkbox.name] = checkbox.value ? true : false;
			});
			api('Transfer.AddVPFTable', params, function(err, result) {
				if (err) {
					return alert(err);
				}
				console.log('got: %j', result);
			});
		})
		//alert('transferring file id ' + row.fileId);
	};

	var render = function($parent, rows) {
		$parent.empty();
		for (var i = 0; i < rows.length; i++) {

			var row = rows[i];
			row.imgUrl = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&full=1&id=' + row.fileId;
			row.imgUrlSmall = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&id=' + row.fileId;

			var $item = $(
				'<li class="span6 vpf item" data-id="' + row.fileId + '"><div class="thumbnail">' +
					'<div class="pull-left thumb-wrapper"><a href="' + row.imgUrl + '">' +
//						'<div class="thumb"></div>' +
						'<div class="thumb" style="background-image: url(\'' + row.imgUrlSmall + '\')"></div>' +
						'<div class="thumb-placeholder"></div>' +
					'</a></div>' +
					'<h3>' + row.title_trimmed + '</h3>' +
					'<p class="pull-right updated hidden-phone-small">' + row.lastUpdateRel + '</p>' +
					'<h4 class="hidden-phone-small">' + row.info + '</h4>' +
					'<ul class="pills small">' +
						'<li><i class="icon user"></i><div class="author hidden-phone-small">' + row.author + '</div></li>' +
						'<li><i class="icon circle-arrow-down" title="' + groupdigit(row.downloads) + '"></i><span class="hidden-desktop-small hidden-phone-small">' + groupdigit(row.downloads) + '</span></li>' +
						'<li><i class="icon eye" title="' + groupdigit(row.views) + '"></i><span class="hidden-desktop-small hidden-phone-small">' + groupdigit(row.views) + '</span></li>' +
						'<li class="link"><a href="http://www.vpforums.org/index.php?app=downloads&showfile=' + row.fileId + '" target="_blank"><i class="icon link"></i></a></li>' +
						'<li class="link transfer"><a href="#"><i class="icon download-alt"></i></a></li>' +
					'</ul>' +
					'<div class="clearfix"></div>' +
				'</div></li>'
			);
			$item.data('row', row);
			$item.find('li.transfer a').click(addTransfer);
			$parent.append($item);
		}

		$parent.find('.thumb').waitForImages({
			each: function() {
				var that = $(this);
				that.parent('a').colorbox({
					transition: "fade",
					photo: true,
					maxWidth: '99%',
					maxHeight: '99%'
				});
				that.addClass('loaded');
			},
			finished: function() {
				// preload hires images
//				$parent.find('.thumb-wrapper > a').each(function() {
//					$('<img/>')[0].src = $(this).attr('href');
//				});
			},
			waitForAll: true
		});
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
