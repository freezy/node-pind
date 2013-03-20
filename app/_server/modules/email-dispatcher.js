var ES = require('./email-settings');
var EM = {};
module.exports = EM;

EM.server = require("emailjs/email").server.connect({

	host : ES.host,
	user : ES.user,
	password : ES.password,
	ssl : true

});

EM.dispatchResetPasswordLink = function(account, callback) {
	EM.composeEmail(account, function(attachment) {
		EM.server.send({
			from : ES.sender,
			to : account.email,
			subject : 'Password Reset',
			text : 'something went wrong... :(',
			attachment : attachment
		}, callback);
	});
}

EM.composeEmail = function(o, callback) {
	getNetworkIPs(function(e, ipaddr) {
		var link = 'http://' + ipaddr + ':' + httpPort + '/reset-password?e=' + o.email + '&p=' + o.pass;
		var html = "<html><body>";
		html += "Hi " + o.name + ",<br><br>";
		html += "Your username is :: <b>" + o.user + "</b><br><br>";
		html += "<a href='" + link + "'>Please click here to reset your password</a><br><br>";
		html += "Cheers,<br>";
		html += "    -The Pinball Spirit.";
		html += "</body></html>";
		callback([
			{data : html, alternative : true}
		]);
	});
}

var getNetworkIPs = (function() {
	var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

	var exec = require('child_process').exec;
	var cached;
	var command;
	var filterRE;

	switch (process.platform) {
		case 'win32':
			//case 'win64': // TODO: test
			command = 'ipconfig';
			filterRE = /\bIPv[46][^:\r\n]+:\s*([^\s]+)/g;
			break;
		case 'darwin':
			command = 'ifconfig';
			filterRE = /\binet\s+([^\s]+)/g;
			// filterRE = /\binet6\s+([^\s]+)/g; // IPv6
			break;
		default:
			command = 'ifconfig';
			filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
			// filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
			break;
	}

	return function(callback, bypassCache) {
		if (cached && !bypassCache) {
			callback(null, cached);
			return;
		}
		// system call
		exec(command, function(error, stdout, sterr) {
			cached = [];
			var ip;
			var matches = stdout.match(filterRE) || [];
			//if (!error) {
			for (var i = 0; i < matches.length; i++) {
				ip = matches[i].replace(filterRE, '$1')
				if (!ignoreRE.test(ip)) {
					cached.push(ip);
				}
			}
			//}
			callback(error, cached);
		});
	};
})();