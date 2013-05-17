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

pindAppModule.directive('deletable', function() {
	return function(scope, element, attrs) {
		$(element).find('li.link.delete').click(function() {
			var id = attrs.id;
			api('Transfer.Delete', {
				id: id
			}, function(err, result) {
				if (err) {
					return alert(err);
				}
				if ($(element).parents('tbody').find('tr').length == 1) {
					scope.$broadcast('paramsUpdated');
				}
				$(element).fadeOut();
			});
		});
	};
});