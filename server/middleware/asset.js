var _ = require('underscore');
var asset = require('../modules/asset');

exports.middleware = function() {

	var sizes = {
		logo: { },
		banner: { small: 655 },
		square: { small: 150, medium: 300 },
		portrait: { small: 250, medium: 800 },
		backglass: { small: 150, medium: 600 },
		widescreen: { small: 200, medium: 450 },
		flyer_front: { medium: 350 },
		flyer_back: { medium: 350 }
	};

	return function(req, res, next) {
		var m = req.originalUrl.match(/^\/asset\/([^\/]+)\/([^\.]+)(\.[^\.]+)?\.png$/i);
		if (m) {
			var what = m[1];
			var key = m[2];
			var size = m[3] ? m[3].substr(1) : null;
			var context = { res: res, req: req };

			if (_.contains(['logo', 'banner', 'square', 'portrait', 'backglass', 'widescreen', 'flyer_front', 'flyer_back'], what)) {
				console.log(req.originalUrl);
				var s = size && sizes[what][size] ? sizes[what][size] : null;
				asset[what].call(asset, context, key, s);
				//asset.backglass(context, key, s);
			} else {
				//console.log(require('util').inspect(res, false, 100, true));
				res.writeHead(404, 'Not found. "' + what + '" is not a known image type.');
				res.end();
			}
		} else {
			next();
		}
	}
};