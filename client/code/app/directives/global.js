module.exports = function (module) {
	'use strict';

	/**
	 * Renders a thumb that fades in when downloaded.
	 *
	 * Attributes:
	 *   - fileid: VPF-ID of the screenshot to render.
	 */
	module.directive('thumb', function() {
		return {
			restrict: 'E',
			replace: true,
			transclude: true,
			template:
				'<div class="pull-left thumb-wrapper"><a href="#">' +
					'<div class="thumb"></div>' +
					'<div class="thumb-placeholder"></div>' +
					'</a></div>',
			link: function(scope, element, attrs) {

				attrs.$observe('fileid', function(value) {
					var a = element.find('a');
					var thumb = element.find('.thumb');

					a.attr('href', 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&full=1&id=' + value);
					thumb.css('background-image', "url('http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&id=" + value + "')");
					thumb.waitForImages({
						each: function() {
							var that = $(this);
							that.parent('a').colorbox({
								transition: "fade",
								photo: true,
								maxWidth: '99%',
								maxHeight: '99%'
							});
							that.addClass('loaded');
						},
						finished: function() {
						// preload hires images
//						$parent.find('.thumb-wrapper > a').each(function() {
//							$('<img/>')[0].src = $(this).attr('href');
//						});
						},
						waitForAll: true
					});
				});
			}
		}
	});

};