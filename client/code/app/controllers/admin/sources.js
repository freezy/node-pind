module.exports = function(module) {
	'use strict';

	module.controller('AdminSourceCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

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
/*		var socket = io.connect('/');

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
		});*/
	}]);

};


$(document).ready(function() {
	return false;

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
