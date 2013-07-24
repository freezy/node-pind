
module.exports = function(module) {
	'use strict';

	module.controller('AdminTransferCtrl', ['$scope', '$log', 'rpc', function($scope, $log, rpc) {

		$log.log('Entered AdminTransferCtrl.');
		$scope.$on('$destroy', function() {
			$log.log('Exited AdminTransferCtrl.');
		});

		$scope.$watch('status', function() {
			console.log('Updated status to: ' + $scope.status);
			$scope.startDisabled = $scope.status == 'idling' || $scope.status == 'transferring';
			$scope.stopDisabled = $scope.status == 'idling' || $scope.status == 'stopped';
			$scope.pauseDisabled = true;
		});

		$scope.start = function() {
			api('Transfer.Control', { action: 'start' }, function(err, result) {
				if (err) {
					return alert('Problem Starting: ' + err);
				}
				$scope.status = result.status;
				$scope.$apply();
				$scope.$broadcast('paramsUpdated');
			});
		};
		$scope.pause = function() {
			alert('not yet implemented.');
		};
		$scope.stop = function() {
			alert('stopped.');
		};

		$scope.resetFailed = function() {
			api('Transfer.ResetFailed', {}, function(err, result) {
				if (err) {
					return alert('Problem resetting failed: ' + err);
				}
				$scope.$broadcast('paramsUpdated');
			});
		};

		// ------------------------------------------------------------------------
		// real time code
		// ------------------------------------------------------------------------

		// download progress bar
/*		ss.event.on('downloadWatch', function(status) {
			$('#transfers tr#' + status.id + ' .progress .bar').css('width', (status.downloadedSize / status.totalSize * 100) + '%')
		});

		// something has changed
		ss.event.on('transferUpdated', function(result) {
			if ($('#transfers tr#' + result.id).length > 0) {
				$scope.$broadcast('paramsUpdated');
			}
		});

		// size was updated
		ss.event.on('transferSizeKnown', function(result) {
			$('#transfers tr#' + result.id + ' td.size').html(result.displaySize);
		});

		// cleared failed downloads
		ss.event.on('transferClearedFailed', function() {
			if ($('#transfers tr.failed').length > 0) {
				$scope.$broadcast('paramsUpdated');
			}
		});

		// new transfer added
		ss.event.on('transferAdded', function() {
			$scope.$broadcast('paramsUpdated');
		});*/

	}]);


	module.controller('AdminTransferItemCtrl', ['$scope', 'rpc', function($scope, rpc) {

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
