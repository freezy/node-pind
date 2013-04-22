load('application');
before(use('requireUser'));

var util = require('util');
var hp = require('./app/modules/hyperpin')(app);

action('banner', function(context) {
	hp.asset_banner(context, params.id);
});

action('banner_small', function(context) {
	hp.asset_banner(context, params.id, 655);
});

action('portrait_small', function(context) {
	hp.asset_table(context, params.id, 350);
});

action('logo', function(context) {
	hp.asset_logo(context, params.id);
});

action('backglass_small', function(context) {
	hp.asset_backglass(context, params.id, 150);
});
