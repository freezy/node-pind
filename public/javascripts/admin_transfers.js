$(document).ready(function() {

});

pindAppModule.directive('sortable', function() {
	return function(scope, element, attrs) {
		if (scope.$last) {
			$(element).parents('tbody').tableDnD({
				onDrop: function(table, row) {
					
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