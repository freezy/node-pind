var fs = require('fs');
var gm = require('gm');

var schema = require('../model/schema');
var settings = require('../../config/settings-mine');

var disableCache = false;

exports.banner = function(context, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Table Images', row), function(gm, callback) {
			gm.rotate('black', -45);
			gm.crop(800, 150, 400, 1250);
			if (size != null) {
				gm.resize(size, size);
			}
			callback(gm);
		});
	}).error(function(err) {
			console.log('Error retrieving table for banner ' + key + ': ' + err);
			context.res.writeHead(500);
		});
};

exports.table = function(context, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Table Images', row), function(gm, callback) {
			gm.rotate('black', -90);
			if (size != null) {
				gm.resize(size, size);
			}
			callback(gm);
		});
	}).error(function(err) {
			console.log('Error retrieving table for table image ' + key + ': ' + err);
			context.res.writeHead(500);
		});
};

exports.logo = function(context, key) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		file(context, getPath('Wheel Images', row));

	}).error(function(err) {
			console.log('Error retrieving table for logo ' + key + ': ' + err);
			context.res.writeHead(500);
		});
};

exports.square = function(context, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Table Images', row), function(gm, callback) {
			gm.rotate('black', -120);
			gm.crop(590, 590, 800, 1100);
			if (size != null) {
				gm.resize(size, size);
			}
			callback(gm);
		});
	}).error(function(err) {
			console.log('Error retrieving table for square ' + key + ': ' + err);
			context.res.writeHead(500);
		});
};


exports.widescreen = function(context, key, size) {

	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Backglass Images', row), function(gm, callback) {

			gm.size(function(err, dim) {
				var ar = 1.777777777777778;
				var h = dim.width / ar;

				gm.crop(dim.width, h, 0, 0);
				if (size != null) {
					gm.resize(size, size);
				}
				callback(gm);
			})
		});
	}).error(function(err) {
			console.log('Error retrieving table for square ' + key + ': ' + err);
			context.res.writeHead(500);
		});

	/*	schema.Table.find({ where: { key : key }}).success(function(row) {
	 asset(context, getPath('Table Images', row), function(gm, callback) {
	 gm.rotate('black', -120);
	 gm.crop(800, 450, 700, 1180);
	 if (size != null) {
	 gm.resize(size, size);
	 }
	 callback(gm);
	 });
	 }).error(function(err) {
	 console.log('Error retrieving table for square ' + key + ': ' + err);
	 context.res.writeHead(500);
	 });*/
};

exports.backglass = function(context, key, size) {
	schema.Table.find({ where: { key : key }}).success(function(row) {
		asset(context, getPath('Backglass Images', row), function(gm, callback) {
			if (size != null) {
				gm.resize(size, size);
			}
			callback(gm);
		});
	}).error(function(err) {
			console.log('Error retrieving table for backglass ' + key + ': ' + err);
			context.res.writeHead(500);
		});
};


var asset = function(context, path, process) {
	if (path && fs.existsSync(path)) {

		// caching
		var modified = new Date(fs.fstatSync(fs.openSync(path, 'r')).mtime);
		var ifmodifiedsince = new Date(context.req.headers['if-modified-since']);
		if (modified.getTime() >= ifmodifiedsince.getTime() && !disableCache) {
			context.res.writeHead(304);
			context.res.end();
			return;
		}

		// cache, process.
		var now = new Date().getTime();
		process(gm(path), function(gm) {
			gm.stream(function (err, stream) {
				if (err) {
                    console.log('ERROR streaming image: ' + err);
                    return context.res.writeHead(500);
                }
				context.res.writeHead(200, {
					'Content-Type': 'image/png',
					'Cache-Control': 'private',
					'Last-Modified': modified
				});
				stream.pipe(context.res);
				console.log("image processed in %d ms.", new Date().getTime() - now);
			});
		});
	} else {
		context.res.writeHead(404);
		context.res.end('Sorry, ' + path + ' not found.');
	}
};

var file = function(context, path) {
	// caching
	var modified = new Date(fs.fstatSync(fs.openSync(path, 'r')).mtime);
	var ifmodifiedsince = new Date(context.req.headers['if-modified-since']);
	if (modified.getTime() >= ifmodifiedsince.getTime()) {
		context.res.writeHead(304);
		context.res.end();
		return;
	}
	if (fs.existsSync(path)) {
		context.res.writeHead(200, { 'Content-Type': 'image/png' });
		var stream = fs.createReadStream(path);
		stream.pipe(context.res);
	} else {
		context.res.writeHead(404);
		context.res.end('Sorry, ' + path + ' not found.');
	}
};

function getPath(what, table) {
	if (table == null) {
		return null;
	}
	return settings.hyperpin.path + '/Media/' + (table.platform == 'FP' ? 'Future' : 'Visual') + ' Pinball/' + what + '/' + table.hpid + '.png';
}