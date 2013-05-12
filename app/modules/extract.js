var fs = require('fs');
var exec = require('child_process').exec;
var unzip = require('unzip');

var settings = require('../../config/settings-mine');

var socket;

module.exports = function(app) {
	socket = app.get('socket.io');
	return exports;
};

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
				console.log(m[2]);
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
 * Extracts a media pack or table video to the correct location. Will not 
 * overwrite anything if files exist already.
 * @param table Row from table
 * @param path Path to the zip archive
 * @param callback Function to execute after completion, invoked with two arguments:
 * 	<ol><li>{String} Error message on error</li>
 * 		<li>{Array} List of extracted files.</li></ol>
 */
exports.extractMedia = function(table, path, callback) {
	var extractedFiles = [];
	var ext = path.substr(path.lastIndexOf('.')).toLowerCase();
	if (ext == '.rar') {
		var rar = new rarfile.RarFile(path, { debugMode: true, rarTool: settings.pind.unrar });
		rar.on('ready', function() {
			console.log('rar contents: %j (%d file(s))', rar.names, rar.length());
			if (rar.length() > 0) {
				var outname = settings.pind.tmp + '/' + rar.names[0];
				var outfile = fs.createWriteStream(outname);
				console.log('writing out to %s', outname);
				rar.on('end', function() {
					console.log('done writing.');
				})
				rar.pipe(rar.names[0], outfile);
			}
		});
//		var outfile = fs.createWriteStream('2_copy.jpg');
//		rf.pipe('2.jpg', outfile);
		return;
	}
	fs.createReadStream(path)
		.pipe(unzip.Parse())
		.on('entry', function (entry) {
			try {
				var dirnames = entry.path.split('/');
				var filename = dirnames.pop();
				var l = dirnames.length - 1;

				var extract = function(entry, dirnames, filename, depth) {
					var ext = filename.substr(filename.lastIndexOf('.'));
					var dest = settings.hyperpin.path + '/Media/' + dirnames.slice(dirnames.length - depth, dirnames.length).join('/') + '/' + table.hpid + ext;
					if (!fs.existsSync(dest)) {
						console.log('Extracting "%s" to "%s"...', entry.path, dest);
						extractedFiles.push(dest);
						entry.pipe(fs.createWriteStream(dest));
					} else {
						console.log('"%s" already exists, skipping.', dest);
						entry.autodrain();
					}
				}

				if (filename) {
					if (['Visual Pinball', 'Future Pinball'].indexOf(dirnames[l - 1]) > -1) {
						if (['Backglass Images', 'Table Images', 'Table Videos', 'Wheel Images'].indexOf(dirnames[l]) > -1) {
							extract(entry, dirnames, filename, 2);
						} else {
							entry.autodrain();
						}

					} else if (['HyperPin'].indexOf(dirnames[l - 2]) > -1) {

						// flyers seem to have a naming convention problem..
						if (dirnames[l - 1] == 'Flyers') {
							dirnames[l - 1] = 'Flyer Images';
						}

						if (['Flyer Images'].indexOf(dirnames[l - 1]) > -1) {
							extract(entry, dirnames, filename, 3);
						} else {
							entry.autodrain();
						}

					} else if (['HyperPin'].indexOf(dirnames[l - 1]) > -1) {

						if (['Instruction Cards'].indexOf(dirnames[l]) > -1) {
							extract(entry, dirnames, filename, 2);
						} else {
							entry.autodrain();
						}
					} else {
						//console.log('2 Ignoring %s (%s)', entry.path, dirnames[l - 2]);
						entry.autodrain();
					}
				} else {
					//console.log('3 Ignoring %s', entry.path);
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