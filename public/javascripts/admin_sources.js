$(document).ready(function() {


	var $scopeElem = $('.ng-scope[ng-controller="DataCtrl"]');
	var dataScope = angular.element($scopeElem).scope();

});

/*
 * Renders a thumb that fades in when downloaded.
 *
 * Attributes:
 *   - fileId: VPF-ID of the screenshot to render.
 */
pindAppModule.directive('thumb', function() {
	return {
		restrict: 'E',
		replace: true,
		transclude: true,
		scope: false,
		template:
			'<div class="pull-left thumb-wrapper"><a href="#">' +
				'<div class="thumb"></div>' +
				'<div class="thumb-placeholder"></div>' +
			'</a></div>',
		link: function(scope, element, attrs) {

			attrs.$observe('fileid', function(value) {
				var a = element.find('a');
				var thumb = element.find('.thumb');

				a.attr('href', 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&full=1&id=' + value);
				thumb.css('background-image', "url('http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&id=" + value + "')");
				thumb.waitForImages({
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
//						$parent.find('.thumb-wrapper > a').each(function() {
//							$('<img/>')[0].src = $(this).attr('href');
//						});
					},
					waitForAll: true
				});
			});
		}
	}
});



var deprecated = function() {

	// download popup action
	var addTransfer = function(event) {
		event.preventDefault();
		var row = $(this).parents('li.item').data('row');

		var $dialog = $('.modal.download-table');
		$dialog.find('.modal-header img').attr('src', row.imgUrlSmall);
		$dialog.find('.modal-header h2 span').html(row.title);
		$dialog.modal('show');
		$dialog.find('.modal-footer button.download').off('click').click(function() {
			var params = { id: row.id };
			$.each($dialog.find('.modal-body form').serializeArray(), function(idx, checkbox) {
				params[checkbox.name] = checkbox.value ? true : false;
			});
			api('Transfer.AddVPFTable', params, function(err, result) {
				if (err) {
					return alert(err);
				}
				console.log('got: %j', result);
			});
		})
	};

	// list rendering
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

	function updateActions(socket) {
		var $downloadIndexBtn = $('.empty button');
		if ($downloadIndexBtn.data('processing')) {

			socket = io.connect('/');
			socket.on('dataUpdated', function() {
				refreshData(config);
			});
			socket.on('progressUpdate', function(msg) {
				$('.progress.indexing .bar').css('width', (msg.progress * 100) + '%');
			});

			$('.progress.indexing').slideDown();
			$downloadIndexBtn.attr('disabled', 'disabled');
			$downloadIndexBtn.find('.icon.refresh').addClass('spin');
			$downloadIndexBtn.find('span').html('Downloading Index...');
		} else {
			if (socket) {
				socket.disconnect();
			}
			$('.progress.indexing').slideUp();
			$downloadIndexBtn.removeAttr('disabled');
			$downloadIndexBtn.find('.icon.refresh').removeClass('spin');
			$downloadIndexBtn.find('span').html('Download index');
		}
	}

	// load data on startup
	enableData(config);
	refreshData(config);

	var socket = null;
	updateActions(socket);

	// enable download index button
	var downloadIndex = function() {

		$(this).data('processing', true);
		updateActions(socket);
		api('VPForums.CreateIndex', {}, function(err, result) {
			if (err) {
				alert('Problem Syncing: ' + err);
			}
		});
	};

	// setup buttons
	$('.empty button').click(downloadIndex);

};

