
module.exports = function(module) {
	'use strict';

	module.controller('AdminTransferCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

		// ------------------------------------------------------------------------
		// actions
		// ------------------------------------------------------------------------

		$scope.start = function(event) {
			event.target.blur();
			rpc('transfer.control', { action: 'start' });
		};
		$scope.pause = function(event) {
			event.target.blur();
			alert('not yet implemented.');
		};
		$scope.stop = function(event) {
			event.target.blur();
			rpc('transfer.control', { action: 'stop' });
		};

		$scope.resetFailed = function(event) {
			event.target.blur();
			rpc('transfer.resetFailed');
		};

		// ------------------------------------------------------------------------
		// status handling
		// ------------------------------------------------------------------------

		var refreshStatus = function() {
			if ($scope.status) {
				var s = $scope.status.status.transfer;
				$scope.startDisabled = s == 'idling' || s == 'transferring';
				$scope.stopDisabled = s == 'idling' || s == 'stopped';
				$scope.pauseDisabled = true;
			}
		};
		var refreshStatusApply = function() {
			$scope.$apply(function() {
				refreshStatus();
			});
		};


		$scope.$on('statusUpdated', refreshStatusApply);
		$scope.$on('statusAvailable', refreshStatusApply);
		refreshStatus();


		// ------------------------------------------------------------------------
		// real time code
		// ------------------------------------------------------------------------

		// transfer deleted
		var transferDeleted = function(result) {
			$('table#transfers tr#' + result.id).fadeOut().promise().done(function() {
				$scope.$broadcast('paramsUpdated');
			});
		};

		// new transfer added
		var refreshTransfers = function() {
			$scope.$broadcast('paramsUpdated');
		};

		// something has changed
		var transferUpdated = function(result) {
			if ($('table#transfers tr#' + result.id).length > 0) {
				$scope.$broadcast('paramsUpdated');
			}
		};

		// transfer order changed
		var transferOrderChanged = function(result) {
			var visible = false;
			_.each(result, function(id) {
				if ($('table#transfers tr#' + id).length > 0) {
					visible = true;
				}
			});
			if (visible) {
				$scope.$broadcast('paramsUpdated');
			}
		};

		// cleared failed downloads
		var transferClearedFailed = function() {
			if ($('table#transfers tr.failed').length > 0) {
				$scope.$broadcast('paramsUpdated');
			}
		};

		// size was updated
		var transferSizeKnown = function(result) {
			$('table#transfers tr#' + result.id + ' td.size').html(result.displaySize);
		};

		// download progress bar
		var transferProgress = function(status) {
			$('table#transfers tr#' + status.id + ' .progress .bar').css('width', (status.downloadedSize / status.totalSize * 100) + '%')
		};


		// hook up events
		ss.event.on('transfer.transferDeleted', transferDeleted);
		ss.event.on('transfer.transferAdded', refreshTransfers);
		ss.event.on('transfer.transferUpdated', transferUpdated);
		ss.event.on('transfer.transferAborted', transferUpdated);
		ss.event.on('transfer.transferClearedFailed', transferClearedFailed);
		ss.event.on('transfer.transferSizeKnown', transferSizeKnown);
		ss.event.on('transfer.transferOrderChanged', transferOrderChanged);
		ss.event.on('transfer.transferProgress', transferProgress);
		ss.event.on('transfer.dataUpdated', refreshTransfers);

		// cleanup on destruction
		$scope.$on('$destroy', function() {
			ss.event.off('transfer.transferDeleted', transferDeleted);
			ss.event.off('transfer.transferAdded', refreshTransfers);
			ss.event.off('transfer.transferUpdated', transferUpdated);
			ss.event.off('transfer.transferAborted', transferUpdated);
			ss.event.off('transfer.transferClearedFailed', transferClearedFailed);
			ss.event.off('transfer.transferSizeKnown', transferSizeKnown);
			ss.event.off('transfer.transferOrderChanged', transferOrderChanged);
			ss.event.off('transfer.transferProgress', transferProgress);
			ss.event.off('transfer.dataUpdated', refreshTransfers);
		});

	}]);


	module.controller('AdminTransferItemCtrl', ['$scope', 'rpc', function($scope, rpc) {


		// ------------------------------------------------------------------------
		// data mapping
		// ------------------------------------------------------------------------

		$scope.classes = ['nodrag', 'nodrop'];
		$scope.progressBarClass = '';
		$scope.progress = '0';
		$scope.dragHandleClass = '';
		$scope.showDragHandle = false;

		$scope.displayName = $scope.transfer.title_match ? $scope.transfer.title_match : $scope.transfer.title;

		if ($scope.transfer.completedAt) {
			$scope.classes.push('completed');
			$scope.progress = '100';

		} else if ($scope.transfer.failedAt) {
			$scope.classes.push('failed');

		} else if ($scope.transfer.startedAt) {
			$scope.classes.push('started');
			$scope.progressBarClass = 'active';
			$scope.progress = $scope.transfer.progress ? $scope.transfer.progress * 100 : '1';

		} else {
			$scope.classes.push('queued');
			$scope.classes.splice(0, 2);
			$scope.showDragHandle = true;
			$scope.dragHandleClass = 'dragHandle';
		}
		var iconmap = {
			table: 'file',
			rom: 'chip',
			mediapack: 'image',
			video: 'video'
		};
		$scope.icon = iconmap[$scope.transfer.type];

		var prev = $scope.data[$scope.$index - 1];
		if (prev && prev.s != $scope.transfer.s) {
			$scope.classes.push('newblock');
		}
	}]);
};
