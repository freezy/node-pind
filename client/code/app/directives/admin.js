module.exports = function (module) {
	'use strict';

	/**
	 * On click, updates the download confirmation dialog and sets up the click
	 * listener of the dialog's button.
	 */
	module.directive('downloadLink', function() {
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
};