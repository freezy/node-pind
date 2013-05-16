$(document).ready(function() {
	// real time code
	var socket = io.connect('/');
	socket.on('downloadWatch', function(status) {
		$('#transfers tr#' + status.id + ' .progress .bar').css('width', (status.downloadedSize / status.totalSize * 100) + '%')
	});
});

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