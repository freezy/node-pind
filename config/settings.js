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
		tmp: 'C:/temp'
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
