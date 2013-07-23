exports.auth = function() {
	return function(req, res, next) {
		if (req.session && req.session.userId) {
			console.log('Authentication OK, next.');
			return next();
		}
		console.err('No auth, no response.');
		res(false);
	}
};
