var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var exec = require('child_process').exec;
var async = require('async');
var unzip = require('unzip');

var settings = require('../../config/settings-mine');

var socket;

module.exports = function(app) {
	socket = app.get('socket.io');
	return exports;
};

/**
 * Extracts files of an archive to the correct location. Currently supported
 * are ZIP or RAR files containing one of the following:
 *   <ul><li>Media packs containing backglass images, flyers, wheel images
 *           and table images</li>
 *       <li>Table videos</li>
 *       <li>Visual Pinball Tables</li>
 * @param filepath
 * @param renameTo
 * @param callback
 */
exports.extract = function(filepath, renameTo, callback) {

	// 1. read files from archive
	exports.getFiles(filepath, function(err, files) {

		if (err) {
			return callback(err);
		}
		console.log('Got files, preparing extraction...');

		// 2. figure out what to extract
		exports.prepareExtract(files, renameTo, function(err, mapping) {

			if (err) {
				return callback(err);
			}
			console.log('Got the following mapping: \r%s', util.inspect(mapping));

			// 3. extract to file system
			var ext = filepath.substr(filepath.lastIndexOf('.')).toLowerCase();
			if (ext == '.rar') {
				exports.rarExtract(filepath, mapping, callback);
			} else if (ext == '.zip') {
				exports.zipExtract(filepath, mapping, callback);
			} else {
				callback('Unknown file extension "' + ext + '".');
			}
		});
	});
}

/**
 * Reads all files of an archive. ZIP and RAR supported.
 * @param filepath Absolute path to the archive
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of files in the archive.</li></ol>
 */
exports.getFiles = function(filepath, callback) {

	var ext = filepath.substr(filepath.lastIndexOf('.')).toLowerCase();

	// RAR code
	if (ext == '.rar') {
		var cmd = '"' + settings.pind.unrar + '" v "' + filepath + '"';

		exec(cmd, function (err, stdout, stderr) {
			if (err) {
				return callback(err);
			}
			if (stderr) {
				return callback(stderr);
			}
			var regex = new RegExp('\\s*([^\\r\\n]+)[\\r\\n]\\s*\\d+\\s+\\d+\\s+\\d+%\\s+[^\\s]+\\s+[^\\s]+\\s+([^\\s]+)\\s+\\d+', 'g');
			var m;
			var filenames = [];
			while (m = regex.exec(stdout)) {
				filenames.push(m[1].trim().replace(/\\/g, '/') + (m[2][1] == 'D' ? '/' : ''));
			}
			callback(null, filenames.sort());
		});

	// ZIP code
	} else if (ext == '.zip') {
		var filenames = [];
		fs.createReadStream(filepath)
		.pipe(unzip.Parse())
		.on('entry', function (entry) {
			filenames.push(entry.path);
			entry.autodrain();

		}).on('close', function() {
			if (callback) {
				callback(null, filenames.sort());
			}
		});

	} else {
		callback('Unknown file extension "' + ext + '".');
	}
}

/**
 * Loops through a given number of files from an archive and determines where to extract them.
 *
 * @param files Array containing path names within the archive (in no particular order)
 * @param renameTo If provided, rename use this as destination file name (extension will be kept, don't provide).
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Object} Object containing file mapping. Attributes are path within the zip files,
 *                   while their values are objects containing <tt>src</tt>
 *                   and <tt>dst</tt>.</li></ol>
 */
exports.prepareExtract = function(files, renameTo, callback) {

	var mapping = {};
	for (var i = 0; i < files.length; i++) {
		var filepath = files[i];
		var dirnames = filepath.split('/');
		var filename = dirnames.pop();
		var l = dirnames.length - 1;

		var asMedia = function(filepath, filename, depth) {
			var ext = filename.substr(filename.lastIndexOf('.'));
			var dst = settings.hyperpin.path + '/Media/' + dirnames.slice(dirnames.length - depth, dirnames.length).join('/') + '/' + (renameTo ? renameTo + ext : filename);
			if (!fs.existsSync(dst)) {
				mapping[filepath] = { src: filepath, dst: dst };
			} else {
				console.log('"%s" already exists, skipping.', dst);
			}
		}

		if (filename) {
			if (['Visual Pinball', 'Future Pinball'].indexOf(dirnames[l - 1]) > -1) {
				if (['Backglass Images', 'Table Images', 'Table Videos', 'Wheel Images'].indexOf(dirnames[l]) > -1) {
					asMedia(filepath, filename, 2);
				}
			} else if (['HyperPin'].indexOf(dirnames[l - 2]) > -1) {

				// flyers seem to have a naming convention problem..
				if (dirnames[l - 1] == 'Flyers') {
					dirnames[l - 1] = 'Flyer Images';
				}

				if (['Flyer Images'].indexOf(dirnames[l - 1]) > -1) {
					asMedia(filepath, filename, 3);
				}

			} else if (['HyperPin'].indexOf(dirnames[l - 1]) > -1) {

				if (['Instruction Cards'].indexOf(dirnames[l]) > -1) {
					asMedia(filepath, filename, 2);
				}
			} else {
				//console.log('2 Ignoring %s (%s)', entry.path, dirnames[l - 2]);
			}
		} else {
			//console.log('3 Ignoring %s', entry.path);
		}
	}
	callback(null, mapping);
};

/**
 * Extracts a given number of files of a zip archive to a given destination for each file.
 *
 * @param zipfile Path to the zip archive
 * @param mapping Object containing file mapping. Attributes are path within the zip files,
 *   while their values are objects containing <tt>src</tt> and <tt>dst</tt>.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of extracted files.</li></ol>
 */
exports.zipExtract = function(zipfile, mapping, callback) {
	var extractedFiles = [];
	fs.createReadStream(zipfile)
	.pipe(unzip.Parse())
	.on('entry', function (entry) {
		try {
			var map = mapping[entry.path];
			if (map) {
				console.log('[unzip] Extracting "%s" to "%s"...', entry.path, map.dst);
				extractedFiles.push(map.dst);
				entry.pipe(fs.createWriteStream(map.dst));
			} else {
				console.log('[unzip] Skipping "%s".', entry.path);
				entry.autodrain();
			}
		} catch (err) {
			callback(err.message);
		}
	})
	.on('close', function() {
		if (callback) {
			callback(null, extractedFiles);
		}
	});
};

/**
 * Extracts a given number of files of a rar archive to a given destination for each file.
 *
 * @param rarfile Path to the rar archive
 * @param mapping Object containing file mapping. Attributes are path within the zip files,
 *   while their values are objects containing <tt>src</tt> and <tt>dst</tt>.
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of extracted files.</li></ol>
 */
exports.rarExtract = function(rarfile, mapping, callback) {

	var extractedFiles = [];
	async.eachSeries(_.values(mapping),
		function(map, next) {
			var dstFolder = map.dst.substr(0, map.dst.lastIndexOf('/'));
			var dstFilename = map.dst.substr(map.dst.lastIndexOf('/') + 1);
			var srcFilename = map.src.substr(map.src.lastIndexOf('/') + 1);
			console.log('[unrar] Extracting "%s" to "%s"...', map.src, map.dst);
			var cmd = '"' + settings.pind.unrar + '" x -ep -y "' + rarfile + '" "' + map.src.replace(/\//g, '\\') + '" "' + dstFolder.replace(/\//g, '\\') + '"';
			console.log('[unrar] > %s', cmd);
			exec(cmd, function (err, stdout, stderr) {
				if (err) {
					return next(err);
				}
				if (stderr) {
					return next(stderr);
				}
				if (!stdout.match(/all ok/i)) {
					return next(stdout);
				}
				extractedFiles.push(map.dst);
				if (dstFilename != srcFilename) {
					console.log('[unrar] Renaming "%s" to "%s"', dstFolder + '/' + srcFilename, map.dst);
					fs.rename(dstFolder + '/' + srcFilename, map.dst, next);
				} else {
					next();
				}
			});

		}, function(err) {
			if (err) {
				return callback(err);
			}
			callback(null, extractedFiles);
		}
	);
};
