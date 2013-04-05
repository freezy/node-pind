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
		 * Secret for hashing stuff. Create something long here: http://strongpasswordgenerator.com/
		 */
		secret: 'alongsecret',
		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 */
		tmp: 'C:/temp',

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
		path: 'C:/Games/Visual Pinball/VPinMame'
	},
	/**
	 * VPForums.org-specific settings.
	 */
	vpforums: {
		/**
		 * VPForums.org credentials. Needed for automatic downloads.
		 */
		user: '', pass: ''
	}
};
