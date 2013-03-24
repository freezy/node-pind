load('application');
before(use('requireUser'));

var util = require('util');
var hp = require('./app/modules/hyperpin')(app);

action('banner', function(context) {
	hp.asset_banner(context.res, params.id);
});
