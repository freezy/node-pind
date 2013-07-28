module.exports = function(module) {
	'use strict';

	module.controller('AdminSourceCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

		// ------------------------------------------------------------------------
		// actions
		// ------------------------------------------------------------------------

		$scope.createIndex = function(event) {
			event.target.blur();
			rpc('vpforums.createIndex');
		};

		$scope.updateIndex = function(event) {
			event.target.blur();
			rpc('vpforums.updateIndex');
		};

		// ------------------------------------------------------------------------
		// status handling
		// ------------------------------------------------------------------------

		$scope.registerEvents({
			dlvpfindex: [ 'vpf.refreshIndexStarted', 'vpf.refreshIndexCompleted' ],
			crvpfindex: [ 'vpf.createIndexStarted', 'vpf.createIndexCompleted', function() {
				var btn = $('.nodata > button');
				btn.attr('disabled', 'disabled');
				btn.find('i.icon').addClass('spin');
				btn.next('.progress').show();
				btn.find('span').html(btn.find('span').data('active'));
				$('.row.footer > h2').addClass('disabled');
				$('.action').addClass('disabled').find('button').attr('disabled', 'disabled');
			} ]
		});

		// ------------------------------------------------------------------------
		// real time code
		// ------------------------------------------------------------------------

		// index refresh/download has finished
		var indexUpdated = function() {
			$scope.$broadcast('paramsUpdated');
		};

		// progress update on initial index download
		var downloadProgressUpdated = function(msg) {
			$('.progress.indexing .bar').css('width', (msg.progress * 100) + '%');
		};

		// transfer added to queue
		var transferAdded = function(data) {
			// add status-queued to download link
			$('div.data li[data-id="' + data.transfer.reference + '"] ul.pills.small li.link.transfer').addClass('status-queued');
			// also add data-transferid to parent
			$('div.data li[data-id="' + data.transfer.reference + '"]').attr('data-transferid', data.transfer.id);
		};

		// transfer removed from queue
		var transferDeleted = function(data) {
			// remove status-* classes
			$('div.data li[data-transferid="' + data.id + '"] ul.pills.small li.link.transfer').removeClass(function(index, css) {
				return (css.match(/\bstatus-\S+/g) || []).join(' ');
			});
			// also remove data-transferid from parent
			$('div.data li[data-transferid="' + data.id + '"]').removeAttr('data-transferid');
		};

		// hook up events
		ss.event.on('vpf.indexUpdated', indexUpdated);
		ss.event.on('vpf.downloadProgressUpdated', downloadProgressUpdated);
		ss.event.on('transfer.transferAdded', transferAdded);
		ss.event.on('transfer.transferDeleted', transferDeleted);

		// cleanup on destruction
		$scope.$on('$destroy', function() {
			ss.event.off('vpf.indexUpdated', indexUpdated);
			ss.event.off('vpf.downloadProgressUpdated', downloadProgressUpdated);
			ss.event.off('transfer.transferAdded', transferAdded);
			ss.event.off('transfer.transferDeleted', transferDeleted);
		});

	}]);

};