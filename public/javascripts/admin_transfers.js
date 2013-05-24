$(document).ready(function() {
	// real time code
	var socket = io.connect('/');
	socket.on('downloadWatch', function(status) {
		$('#transfers tr#' + status.id + ' .progress .bar').css('width', (status.downloadedSize / status.totalSize * 100) + '%')
	});

	var status = $('#transfers').data('status');

});

function TransferCtrl($scope) {

	$scope.$watch('status', function() {
		console.log('Updated status to: ' + $scope.status);
		$scope.startDisabled = $scope.status == 'idling' || $scope.status == 'transferring';
		$scope.stopDisabled = $scope.status == 'idling' || $scope.status == 'stopped';
		$scope.pauseDisabled = true;
	});
	$scope.status = $('#transfers').data('status');

	$scope.start = function() {
		api('Transfer.Control', { action: 'start' }, function(err, result) {
			if (err) {
				return alert('Problem Starting: ' + err);
			}
			$scope.status = result.status;
			$scope.$apply();
		});
	}
	$scope.pause = function() {
		alert('not yet implemented.');
	}
	$scope.stop = function() {
		alert('stopped.');
	}

	$scope.resetFailed = function() {
		api('Transfer.ResetFailed', {}, function(err, result) {
			if (err) {
				return alert('Problem resetting failed: ' + err);
			}
			$scope.$broadcast('paramsUpdated');
		});
	}
}

function TransferItemCtrl($scope) {

	$scope.classes = ['nodrag', 'nodrop'];
	$scope.progressBarClass = '';
	$scope.progress = '0';
	$scope.dragHandleClass = '';
	$scope.showDragHandle = false;

	if ($scope.transfer.completedAt) {
		$scope.classes.push('completed');
		$scope.progress = '100';

	} else if ($scope.transfer.failedAt) {
		$scope.classes.push('failed');

	} else if ($scope.transfer.startedAt) {
		$scope.classes.push('started');
		$scope.progressBarClass = 'active';
		$scope.progress = '5';

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
	}
	$scope.icon = iconmap[$scope.transfer.type];
}

pindAppModule.directive('sortable', function() {
	return function(scope, element, attrs) {
		if (scope.$last) {
			// http://isocra.com/2008/02/table-drag-and-drop-jquery-plugin/
			$(element).parents('tbody').tableDnD({
				onDrop: function(table, row) {
					var next = $(row).next().attr('id');
					var prev = $(row).prev().attr('id');
					api('Transfer.Reorder', {
						id: $(row).attr('id'),
						between: {
							prev: prev ? prev : 0,
							next: next ? next : 0
						}
					}, function(err, result) {
						if (err) {
							alert(err);
						}
					});
				},
				dragHandle: '.dragHandle',
				onDragClass: 'dragging'
			});
		}
	};
});

pindAppModule.directive('deletable', function() {
	return function(scope, element, attrs) {
		if (!scope.transfer.startedAt || scope.transfer.completedAt || scope.transfer.failedAt) {
			$(element).find('li.link.delete').click(function() {
				var id = attrs.id;
				api('Transfer.Delete', {
					id: id
				}, function(err, result) {
					if (err) {
						return alert(err);
					}
					if ($(element).parents('tbody').find('tr').length == 1) {
						scope.$parent.$broadcast('paramsUpdated');
					}
					$(element).fadeOut();
				});
			});
		} else {
			$(element).find('li.link.delete').addClass('disabled');
		}
		
	};
});