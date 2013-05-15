$(document).ready(function() {

});

pindAppModule.directive('sortable', function() {
	return function(scope, element, attrs) {
		if (scope.$last) {
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


/*
pindAppModule.directive('sortable', function() {
	return {
		restrict: 'A',
		link: function(scope, element) {
			scope.$on('transfersReady', function() {
				
			});
		}
	}
});*/