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

	// transfer added to queue
	socket.on('transferAdded', function(data) {

		// add status-queued to download link
		$('div.data li[data-id="' + data.transfer.reference + '"] ul.pills.small li.link.transfer')
			.addClass('status-queued');

		// also add data-transferid to parent
		$('div.data li[data-id="' + data.transfer.reference + '"]').attr('data-transferid', data.transfer.id);
	});

	// transfer removed from queue
	socket.on('transferDeleted', function(data) {

		// remove status-* classes
		$('div.data li[data-transferid="' + data.id + '"] ul.pills.small li.link.transfer')
			.removeClass(function(index, css) {
				return (css.match(/\bstatus-\S+/g) || []).join(' ');
			});

		// also remove data-transferid from parent
		$('div.data li[data-transferid="' + data.id + '"]').removeAttr('data-transferid');
	});
}

function SourceItemCtrl($scope) {

}

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
				showDialog(scope.row);

			// double click
			}, function() {
				var savedOptions = $.cookie('downloadOptions');

				if (!savedOptions) {
					showDialog(scope.row);
				} else {
					queryTransfer(scope.row.id, savedOptions);
				}

			}, 300);
		}
	}
});
