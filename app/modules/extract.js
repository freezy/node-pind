var _ = require('underscore');
var fs = require('fs');
var util = require('util');
var exec = require('child_process').exec;
var async = require('async');
var unzip = require('unzip');
var events = require('events');

var settings = require('../../config/settings-mine');


function Extract(app) {
	if ((this instanceof Extract) === false) {
		return new Extract(app);
	}
	events.EventEmitter.call(this);
}
util.inherits(Extract, events.EventEmitter);


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
Extract.prototype.extract = function(filepath, renameTo, callback) {
	var that = this;

	// 1. read files from archive
	that.getFiles(filepath, function(err, files) {

		if (err) {
			return callback(err);
		}
		console.log('[extract] Got %d entries, preparing extraction...', files.length);

		// 2. figure out what to extract
		that.prepareExtract(files, renameTo, function(err, mapping) {

			if (err) {
				return callback(err);
			}

			// 3. extract to file system
			var ext = filepath.substr(filepath.lastIndexOf('.')).toLowerCase();
			if (ext == '.rar') {
				that.rarExtract(filepath, mapping, callback);
			} else if (ext == '.zip') {
				that.zipExtract(filepath, mapping, callback);
			} else {
				callback('Unknown file extension "' + ext + '".');
			}
		});
	});
};

/**
 * Reads all files of an archive. ZIP and RAR supported.
 * @param filepath Absolute path to the archive
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of files in the archive.</li></ol>
 */
Extract.prototype.getFiles = function(filepath, callback) {

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
};

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
Extract.prototype.prepareExtract = function(files, renameTo, callback) {

	var mapping = { extract: {}, skip: {}, ignore: [] };

	for (var i = 0; i < files.length; i++) {
		const filepath = files[i];
        const dirnames = filepath.split('/');
        const filename = dirnames.pop();
        const l = dirnames.length - 1;

		// adds it to the queue if not already exists
		function add(dst, filepath) {
			if (!fs.existsSync(dst)) {
				mapping.extract[filepath] = { src: filepath, dst: dst };
			} else {
				mapping.skip[filepath] = { src: filepath, dst: dst };
				console.log('[extract] "%s" already exists, skipping.', dst);
			}
		}

		// adds it to the queue using the typical
		function asMedia(depth, filename, filepath, dirnames) {
            const ext = filename.substr(filename.lastIndexOf('.'));
            const dst = settings.hyperpin.path + '/Media/' + dirnames.slice(dirnames.length - depth, dirnames.length).join('/') + '/' + (renameTo ? renameTo + ext : filename);
			add(dst, filepath);
		}

		if (filename) {
            const ext = filename.substr(filename.lastIndexOf('.'));

			// VP/FP-specific artwork
			if (_.contains(['Visual Pinball', 'Future Pinball'], dirnames[l - 1])) {
				if (_.contains(['Backglass Images', 'Table Images', 'Table Videos', 'Wheel Images'], dirnames[l])) {
					asMedia(2, filename, filepath, dirnames);
				} else {
					mapping.ignore.push(filepath);
				}

			// HyperPin-specific artwork
			} else if (_.contains(['HyperPin'], dirnames[l - 2])) {

				// flyers seem to have a naming convention problem..
				if (dirnames[l - 1] == 'Flyers') {
					dirnames[l - 1] = 'Flyer Images';
				}

				if (_.contains(['Flyer Images'], dirnames[l - 1])) {
					asMedia(3, filename, filepath, dirnames);
				} else {
					mapping.ignore.push(filepath);
				}

			} else if (_.contains(['HyperPin'], dirnames[l - 1])) {

				if (_.contains(['Instruction Cards'], dirnames[l])) {
					asMedia(2, filename, filepath, dirnames);
				} else {
					mapping.ignore.push(filepath);
				}

			// VP tables
			} else if (_.contains(['.vpt', '.vbs', '.exe'], ext)) {
				add(settings.visualpinball.path + '/Tables/' + filename, filepath);

			// Music
			} else if (_.contains(['.mp3', '.wma'], ext)) {
				if (fs.existsSync(settings.visualpinball.path + '/Tables/Music')) {
					add(settings.visualpinball.path + '/Tables/Music/' + filename, filepath);
				} else {
					mapping.ignore.push(filepath);
				}
			} else {
				mapping.ignore.push(filepath);
			}
		} else {
			console.log('Ignoring %s', filepath);
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
Extract.prototype.zipExtract = function(zipfile, mapping, callback) {
	fs.createReadStream(zipfile)
	.pipe(unzip.Parse())
	.on('entry', function (entry) {
		try {
			var map = mapping.extract[entry.path];
			if (map) {
				console.log('[unzip] Extracting "%s" to "%s"...', entry.path, map.dst);
				map.extracted = true;
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
			callback(null, mapping);
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
Extract.prototype.rarExtract = function(rarfile, mapping, callback) {

	console.log('[extract] mapping:\n%j', mapping.extract);
	async.eachSeries(_.values(mapping.extract),
		function(map, next) {
			var dstFolder = map.dst.substr(0, map.dst.lastIndexOf('/'));
			var dstFilename = map.dst.substr(map.dst.lastIndexOf('/') + 1);
			var srcFilename = map.src.substr(map.src.lastIndexOf('/') + 1);
			console.log('[unrar] Extracting "%s" to "%s"...', map.src, map.dst);
			// TODO extract to tmp if to be renamed so there are no name conflicts.
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
				map.extracted = true;
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
			callback(null, mapping);
		}
	);
};

module.exports = Extract;