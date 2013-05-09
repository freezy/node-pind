$(document).ready(function() {

	function updateActions(socket) {
		var $downloadIndexBtn = $('.nodata button');
		if ($downloadIndexBtn.data('processing')) {

			socket = io.connect('/');
			socket.on('dataUpdated', function() {
				var scope = angular.element($('.ng-scope[ng-controller="DataCtrl"]')).scope();
				scope.$broadcast('paramsUpdated');
			});
			socket.on('progressUpdate', function(msg) {
				$('.progress.indexing .bar').css('width', (msg.progress * 100) + '%');
			});

			$('.progress.indexing').slideDown();
			$downloadIndexBtn.attr('disabled', 'disabled');
			$downloadIndexBtn.find('.icon.refresh').addClass('spin');
			$downloadIndexBtn.find('span').html('Downloading index...');
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

	var socket = null;
	updateActions(socket);

	// enable download index button
	var downloadIndex = function() {

		$(this).blur();
		$(this).data('processing', true);
		updateActions(socket);
		api('VPForums.CreateIndex', {}, function(err, result) {
			if (err) {
				alert('Problem Syncing: ' + err);
			}
		});
	};

	// setup buttons
	$('.nodata button').click(downloadIndex);

});


/*
 * Renders a thumb that fades in when downloaded.
 *
 * Attributes:
 *   - fileid: VPF-ID of the screenshot to render.
 */
pindAppModule.directive('thumb', function() {
	return {
		restrict: 'E',
		replace: true,
		transclude: true,
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

pindAppModule.directive('downloadLink', function() {
	return {
		restrict: 'C',
		link: function(scope, element) {
			element.click(function(event) {

				event.preventDefault();
				var row = scope.data[$(this).parents('li.item').data('idx')];

				var $dialog = $('.modal.download-table');
				$dialog.find('.modal-header img').attr('src', 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&id=' + row.fileId);
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
			});
		}
	}
});
