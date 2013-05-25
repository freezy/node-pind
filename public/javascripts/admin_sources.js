$(document).ready(function() {

	function updateActions() {
		var $downloadIndexBtn = $('.nodata button');
		if ($downloadIndexBtn.data('processing')) {

			$('.progress.indexing').slideDown();
			$downloadIndexBtn.attr('disabled', 'disabled');
			$downloadIndexBtn.find('.icon.refresh').addClass('spin');
			$downloadIndexBtn.find('span').html('Downloading index...');

		} else {

			$('.progress.indexing').slideUp();
			$downloadIndexBtn.removeAttr('disabled');
			$downloadIndexBtn.find('.icon.refresh').removeClass('spin');
			$downloadIndexBtn.find('span').html('Download index');
		}
	}

	updateActions();

	// enable download index button
	var downloadIndex = function() {

		$(this).blur();
		$(this).data('processing', true);
		updateActions();
		api('VPForums.CreateIndex', {}, function(err, result) {
			if (err) {
				alert('Problem Syncing: ' + err);
			}
		});
	};

	// setup buttons
	$('.nodata button').click(downloadIndex);

});

function SourceCtrl($scope) {

	$scope.updateIndex = function() {
		api('VPForums.UpdateIndex', {}, function(err, result) {
			if (err) {
				alert('Problem Syncing: ' + err);
			}
		});
	};

	// ------------------------------------------------------------------------
	// real time code
	// ------------------------------------------------------------------------
	var socket = io.connect('/');

	// index refresh/download has finished
	socket.on('downloadIndexUpdated', function() {
		$scope.$broadcast('paramsUpdated');
	});

	// download progress update
	socket.on('downloadProgressUpdated', function(msg) {
		$('.progress.indexing .bar').css('width', (msg.progress * 100) + '%');
	});

	// transfer removed from queue
	socket.on('transferDeleted', function(data) {

		// remove status-* classes
		$('div.data li[data-transferid="' + data.id + '"] ul.pills.small li.link.transfer')
			.removeClass(function(index, css) {
				return (css.match(/\bstatus-\S+/g) || []).join(' ');
			});
	});
}

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

/**
 * On click, updates the download confirmation dialog and sets up the click
 * listener of the dialog's button.
 */
pindAppModule.directive('downloadLink', function() {
	return {
		restrict: 'C',
		link: function(scope, element) {

			var queryTransfer = function(id, params) {
				params.id = id;
				api('Transfer.AddVPFTable', params, function(err, result) {
					if (err) {
						return alert(err);
					}
					console.log('got: %j', result);
				});
			};
			var showDialog = function(row) {

				var $dialog = $('.modal.download-table');
				$dialog.find('.modal-header img').attr('src', 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&id=' + row.fileId);
				$dialog.find('.modal-header h2 span').html(row.title);
				var savedOptions = $.cookie('downloadOptions');
				if (savedOptions) {
					$dialog.find('form input[type="checkbox"]').each(function() {
						if (savedOptions[$(this).attr('name')] !== undefined) {
							$(this).prop('checked', savedOptions[$(this).attr('name')])
						}
					});
				}
				$dialog.modal('show');
				$dialog.find('.modal-footer button.download').off('click').click(function() {
					var params = {};

					// get values for API request
					$.each($dialog.find('.modal-body form').serializeArray(), function(idx, checkbox) {
						params[checkbox.name] = checkbox.value ? true : false;
					});

					// save values to cookie
					$.cookie('downloadOptions', params);
					queryTransfer(row.id, params);
				});
			};

			// single click
			$(element).sdclick(function() {
				showDialog(scope.data[$(this).parents('li.item').data('idx')]);

			// double click
			}, function() {
				var row = scope.data[$(this).parents('li.item').data('idx')];
				var savedOptions = $.cookie('downloadOptions');

				if (!savedOptions) {
					showDialog(row);
				} else {
					queryTransfer(row.id, savedOptions);
				}

			}, 300);
		}
	}
});
