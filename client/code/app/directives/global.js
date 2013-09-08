module.exports = function (module) {
	'use strict';

	/**
	 * Enables the hiscore flipper that shows extended high scores when
	 * hovering over the image.
	 */
	module.directive('slider', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {

				var running = false;
				var down = false;
				var duration = parseInt(attrs['slider']);
				var slider = element.find('.thumbnail-content .slider');

				element.find('.slider > .img_wrapper > img').click(function() {

					var img = $(this);
					if (running) {
						slider.stop();
					}
					var pos = down ? { top: '-286px' } : { top : (54 - img.height()) + 'px' };
					running = true;
					down = !down;
					slider.animate(pos, duration, function() {
						running = false;
						if (down) {
							img.addClass('bottom');
						} else {
							img.removeClass('bottom');
						}
					});

				});
			}
		}
	});

	module.directive('offlinebar', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				var show = function() {
					element.removeClass('animated bounceOutDown').show().addClass('animated bounceInUp');
				};
				var hide = function() {
					element.removeClass('animated bounceInUp').addClass('animated bounceOutDown');
				};
				ss.server.on('disconnect', function() {
					show();
				});
				ss.server.on('reconnect', function() {
					hide();
				});
				ss.server.on('ready', function() {
					hide();
				});
			}
		}
	});

	module.directive('imgload', function() {
		return {
			restrict: 'A',
			link: function(scope, element) {
				element.bind("load" , function(){
					element.parent().addClass('loaded');
				});
			}
		}
	});


	module.directive('animresize', function() {
		return {
			restrict: 'A',
			link: function(scope, element) {
				var oldHeight = 0;
				scope.$on('dataViewUpdated', function() {
					var newHeight = element.height();
					element.height(oldHeight);
					element.animate({ height: newHeight }, 'slow', function() {
						element.height('auto');
					});
				});
				scope.$on('dataUpdated', function() {
					oldHeight = element.height();
				});
			}
		}
	});

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
				'<div class="thumb-wrapper"><a href="#">' +
					'<div class="thumb"></div>' +
					'<div class="thumb-placeholder"></div>' +
					'</a></div>',
			link: function(scope, element, attrs) {

				attrs.$observe('fileid', function(value) {
					var urlFull, urlSmall;
					var a = element.find('a');
					var thumb = element.find('.thumb');
					if (value.substr(0, 7) == 'http://') {
						urlFull = value;
						urlSmall = value;
					} else if (value && value != 'null') {
						urlFull = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&full=1&id=' + value;
						urlSmall = 'http://www.vpforums.org/index.php?app=downloads&module=display&section=screenshot&id=' + value;

					} else {
						return;
					}

					a.attr('href', urlFull);
					thumb.css('background-image', "url('" + urlSmall + "')");
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