/**
 * Global settings file for pind. This is the only configuration setting
 * you'll have to edit.
 */
module.exports = {
	/**
	 * Application-specific settings.
	 */
	pind: {
		/**
		 * Where the HTTP server listens; 80 is the default port.
		 */
		port: 80,
		/**
		 * Session timeout in milliseconds.
		 */
		sessionTimeout: 3600000,
		/**
		 * Interval for download updates on the downloads page for the progress bars.
		 */
		downloaderRefreshRate: 3000,
		/**
		 * If true, queueing will automatically start the download queue. Same when
		 * application starts and there are still items in the queue.
		 * If false, download queue must be started manually.
		 */
		startDownloadsAutomatically: true,
		/**
		 * Secret for hashing stuff. Create something long here: http://strongpasswordgenerator.com/
		 */
		secret: 'alongsecret',
		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 */
		tmp: 'C:/temp',

		/**
		 * Absolute path to where unrar.exe is located.
		 * You can download it here:
		 * 		http://sourceforge.net/projects/gnuwin32/files/unrar/3.4.3/unrar-3.4.3.exe/download
		 */
		unrar: 'C:/Program Files (x86)/GnuWin32/bin/unrar.exe',

		/**
		 * Set this to true if you don't use table videos.
		 */
		ignoreTableVids: false,

		/**
		 * Database configuration.
		 */
		database: {

			/**
			 * Which database engine to use. Either sqlite (default) or mysql.
			 */
			engine: 'sqlite',
			/**
			 * When using MySQL, this is the name of the database, which must exist already.
			 * When using SQLite, it's the name of the file (without extension).
			 */
			database: 'pind',
			/**
			 * MySQL host.
			 * Ignore this if you're using SQLite.
			 */
			host: 'localhost',
			/**
			 * MySQL port.
			 * Ignore this if you're using SQLite.
			 */
			port: 3306,
			/**
			 * MySQL user. When using MySQL, you'll have to create this user manually before.
			 * Ignore this if you're using SQLite.
			 */
			user: 'pind',
			/**
			 * MySQL password.
			 * Ignore this if you're using SQLite.
			 */
			pass: ''
		}
	},
	/**
	 * HyperPin-specifc settings.
	 */
	hyperpin : {
		/**
		 * Path to installation folder. No trailing slash!
		 */
		path: 'C:/Games/HyperPin'
	},
	/**
	 * Visual Pinball-specifc settings.
	 */
	visualpinball : {
		/**
		 * Path to installation folder. No trailing slash!
		 */
		path: 'C:/Games/Visual Pinball'
	},
	/**
	 * Future Pinball-specifc settings.
	 */
	futurepinball : {
		/**
		 * Path to installation folder. No trailing slash!
		 */
		path: 'C:/Games/Future Pinball'
	},
	/**
	 * VPinMame-specifc settings.
	 */
	vpinmame : {
		/**
		 * Path to installation folder. No trailing slash!
		 */
		path: 'C:/Games/Visual Pinball/VPinMame',
		/**
		 * When bulk-applying rotation settings on tables, this indicates how to set the "rol" setting.
		 * If set to true, the DMD will be rotated 90°, otherwise it will have the same orientation as
		 * the playfield.
		 */
		rotate: false,
		/**
		 * Watches for the ROM's data container for file changes. Set this to true if you want to get
		 * your high scores updated automatically.
		 */
		watchNvrams: true
	},
	/**
	 * VPForums.org-specific settings.
	 */
	vpforums: {
		/**
		 * VPForums.org credentials. Needed for automatic downloads.
		 */
		user: '', pass: '',
		/**
		 * Number of concurrent downloads allowed.
		 */
		numConcurrentDownloads: 3
	}
};
