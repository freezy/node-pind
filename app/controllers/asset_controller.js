load('application');
before(use('requireUser'));

var util = require('util');
var hp = require('./app/modules/hyperpin')(app);

action('banner', function(context) {
	hp.asset_banner(context.res, params.id);
});

action('portrait_small', function(context) {
	hp.asset_table(context.res, params.id, 350);
});
