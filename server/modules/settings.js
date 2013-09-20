var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var logger = require('winston');
var settings;

module.exports = {

	validate: function() {
		var settingsPath = path.normalize(__dirname + '/../../config/settings-mine.js');
		if (!fs.existsSync(settingsPath)) {
			logger.log('info', '[settings] Setting file not found. Please copy config/settings.js to  %s and retry.', settingsPath);
			return false;
		}

		logger.log('info', '[settings] Validating settings at %s', settingsPath);
		settings = require('../../config/settings-mine');
		var val = function(validation, setting, path) {

			var validationError, p;
			for (var s in validation) {
				if (validation.hasOwnProperty(s)) {
					p = (path + '.' + s).substr(1);
					if (_.isFunction(validation[s])) {
						validationError = validation[s](setting[s]);
						if (!validationError) {
							logger.log('info', '[settings] %s [OK]', p);
						} else {
							logger.log('error', '[settings] Illegal setting %s: %s', p, validationError);
							return false;
						}
					}

					if (validation[s] && _.isObject(validation[s])) {

						if (_.isUndefined(setting[s])) {
							logger.log('error', '[settings] Missing setting %s', p);
							return false;
						}
						if (!val(validation[s], setting[s], path + '.' + s)) {
							return false;
						}
					}
				}
			}
			if (!path) {
				logger.log('info', '[settings] Congrats, your settings-mine.js looks splendid!');
			}

			return true;
		};
		return val(validations, settings, '');
	}
};

/**
 * Settings validator. Same structure as settings, but contains
 * validation functions instead of default values.
 *
 */
var validations = {

	/**
	 * Application-specific settings.
	 */
	pind: {

		/**
		 * Where the HTTP server listens; 80 is the default port.
		 */
		port: function(port) {
			if (!parseInt(port) || parseInt(port) > 65535 || parseInt(port) < 1) {
				return 'Port must be an integer between 1 and 65535.'
			}
		},

		/**
		 * Session timeout in milliseconds.
		 */
		sessionTimeout: function(timeout) {
			if (!parseInt(timeout) || parseInt(timeout) < 1) {
				return 'Session timeout must be a number greater than 0.'
			}
		},

		/**
		 * Interval for download updates on the downloads page for the progress bars.
		 */
		downloaderRefreshRate: function(rate) {
			if (!parseInt(rate) || parseInt(rate) < 1) {
				return 'Download interval must be a number greater than 0.'
			}
		},

		/**
		 * If true, queueing will automatically start the download queue. Same when
		 * application starts and there are still items in the queue.
		 * If false, download queue must be started manually.
		 */
		startDownloadsAutomatically: function(bool) {
			if (!_.isBoolean(bool)) {
				return 'Value must be a boolean (either "true" or "false").';
			}
		},

		/**
		 * Secret for hashing stuff. Create something long here: http://strongpasswordgenerator.com/
		 * @important
		 */
		secret: function(secret) {
			if (secret.length < 10) {
				return 'Your secret must be longer than 10 characters. Please use a generator, e.g. http://strongpasswordgenerator.com/.';
			}
			if (secret == 'alongsecret') {
				return 'You\'re using the default secret. Please use a generator, e.g. http://strongpasswordgenerator.com/.';
			}
		},

		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 * @important
		 */
		tmp: function(path) {
			if (!fs.existsSync(path)) {
				return 'Temp path "' + path + '" does not exist. Please point it to an existing folder or create the mentioned path.';
			}

			if (!fs.lstatSync(path).isDirectory()) {
				return 'Temp path "' + path + '" is not a folder. Please make it point to a folder.';
			}
		},

		/**
		 * Absolute path to where unrar.exe is located.
		 * You can download it here:
		 * 		http://sourceforge.net/projects/gnuwin32/files/unrar/3.4.3/unrar-3.4.3.exe/download
		 * @important
		 */
		unrar: function(path) {
			if (!fs.existsSync(path)) {
				return 'The unrar binary does not exist at "' + path + '". Please update path or install it from http://gnuwin32.sourceforge.net/downlinks/unrar.php';
			}
		},

		/**
		 * Set this to true if you don't use table videos.
		 */
		ignoreTableVids: function(bool) {
			if (!_.isBoolean(bool)) {
				return 'Value must be a boolean (either "true" or "false").';
			}
		},

		/**
		 * Database configuration.
		 */
		database: {

			/**
			 * Which database engine to use. Either sqlite (default) or mysql.
			 */
			engine: function(engine) {
				var values = ['sqlite', 'mysql'];
				if (!_.contains(values, engine)) {
					return 'Wrong database engine "' + engine + '". Must be one of: [ ' + values.join(' ') + ' ].';
				}
			},

			/**
			 * When using MySQL, this is the name of the database, which must exist already.
			 * When using SQLite, it's the name of the file (without extension).
			 */
			database: function(value) {
				if (settings.pind.database.engine == 'mysql') {
					if (!value) {
						return 'Database name must be set if using MySQL.';
					}
				}
			},

			/**
			 * MySQL host.
			 * Ignore this if you're using SQLite.
			 */
			host: function(value) {
				if (settings.pind.database.engine == 'mysql') {
					if (!value) {
						return 'Database host must be set if using MySQL.';
					}
				}
			},

			/**
			 * MySQL port.
			 * Ignore this if you're using SQLite.
			 */
			port: function(value) {
				if (settings.pind.database.engine == 'mysql') {
					if (!value) {
						return 'Database port must be set if using MySQL.';
					}
				}
			},

			/**
			 * MySQL user. When using MySQL, you'll have to create this user manually before.
			 * Ignore this if you're using SQLite.
			 */
			user: function(value) {
				if (settings.pind.database.engine == 'mysql') {
					if (!value) {
						return 'Database user must be set if using MySQL.';
					}
				}
			},

			/**
			 * MySQL password.
			 * Ignore this if you're using SQLite.
			 */
			pass: function(value) {
				if (settings.pind.database.engine == 'mysql') {
					if (!value) {
						return 'Database password must be set if using MySQL.';
					}
				}
			}
		},

		/**
		 * Where to update Pind from. Provide your GitHub fork here if requested.
		 * Default is https://github.com/freezy/node-pind
		 */
		repository: {
			user: function(user) {
				if (!user) {
					return 'GitHub user of repository must be set.';
				}
			},
			repo: function(user) {
				if (!user) {
					return 'GitHub repository must be set.';
				}
			}
		},

		/**
		 * If set to true, the auto-updater will not only retrieve latest releases but
		 * every commit that is pushed to the repository. Only recommended when
		 * developing or testing.
		 */
		updateToBleedingEdge: function(bool) {
			if (!_.isBoolean(bool)) {
				return 'Value must be a boolean (either "true" or "false").';
			}
		}
	},

	/**
	 * HyperPin-specifc settings.
	 */
	hyperpin : {

		/**
		 * Path to installation folder. No trailing slash!
		 * @important
		 */
		path: function(path) {
			if (!fs.existsSync(path)) {
				return 'HyperPin path "' + path + '" does not exist. Please point it to an existing folder or create the mentioned path.';
			}

			if (!fs.lstatSync(path).isDirectory()) {
				return 'HyperPin path "' + path + '" is not a folder. Please make it point to a folder.';
			}
		},

		/**
		 * When a table is disabled in HyperPin, Pind can either remove it from
		 * the database XML file completely or put it into comments.
		 *
		 * Allowed values: "comment" (default), "remove".
		 */
		onItemDisabled: function(onitemd) {
			var values = ['comment', 'remove'];
			if (!_.contains(values, onitemd)) {
				return 'Action when item is disabled must be one of: [ ' + values.join(' ') + ' ] but is "' + onitemd + '".';
			}
		}

	},

	/**
	 * Visual Pinball-specifc settings.
	 */
	visualpinball : {

		/**
		 * Path to installation folder. No trailing slash!
		 * @important
		 */
		path: function(path) {
			if (!fs.existsSync(path)) {
				return 'Visual Pinball path "' + path + '" does not exist. Please point it to an existing folder or create the mentioned path.';
			}

			if (!fs.lstatSync(path).isDirectory()) {
				return 'Visual Pinball path "' + path + '" is not a folder. Please make it point to a folder.';
			}
		}
	},

	/**
	 * Future Pinball-specifc settings.
	 */
	futurepinball : {

		/**
		 * Path to installation folder. No trailing slash!
		 * @important
		 */
		path: function(path) {
			if (!fs.existsSync(path)) {
				return 'Future Pinball path "' + path + '" does not exist. Please point it to an existing folder or create the mentioned path.';
			}

			if (!fs.lstatSync(path).isDirectory()) {
				return 'Future Pinball path "' + path + '" is not a folder. Please make it point to a folder.';
			}
		}
	},

	/**
	 * VPinMame-specifc settings.
	 */
	vpinmame : {

		/**
		 * Path to installation folder. No trailing slash!
		 * @important
		 */
		path: function(path) {
			if (!fs.existsSync(path)) {
				return 'VPinMAME path "' + path + '" does not exist. Please point it to an existing folder or create the mentioned path.';
			}

			if (!fs.lstatSync(path).isDirectory()) {
				return 'VPinMAME path "' + path + '" is not a folder. Please make it point to a folder.';
			}
		},

		/**
		 * When bulk-applying rotation settings on tables, this indicates how to set the "rol" setting.
		 * If set to true, the DMD will be rotated 270°, otherwise it will have the same orientation as
		 * the playfield.
		 */
		rotate: function(bool) {
			if (!_.isBoolean(bool)) {
				return 'Value must be a boolean (either "true" or "false").';
			}
		},

		/**
		 * Watches for the ROM's data container for file changes. Set this to true if you want to get
		 * your high scores updated automatically.
		 */
		watchNvrams: function(bool) {
			if (!_.isBoolean(bool)) {
				return 'Value must be a boolean (either "true" or "false").';
			}
		}
	},

	/**
	 * VPForums.org-specific settings.
	 */
	vpforums: {

		/**
		 * VPForums.org credentials. Needed for automatic downloads.
		 */
		user: null, pass: null,

		/**
		 * Number of concurrent downloads allowed.
		 */
		numConcurrentDownloads: function(num) {
			if (!parseInt(num) || parseInt(num) < 1) {
				return 'Number of concurrent downloads must be an integer greater than 0.'
			}
		}
	},

	/**
	 * Ipdb.org-specific settings.
	 */
	ipdb: {

		/**
		 * Number of concurrent downloads allowed.
		 */
		numConcurrentDownloads: function(num) {
			if (!parseInt(num) || parseInt(num) < 1) {
				return 'Number of concurrent downloads must be an integer greater than 0.'
			}
		}
	}
};
