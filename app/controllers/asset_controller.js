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

action('portrait_medium', function(context) {
	hp.asset_table(context, params.id, 800);
});

action('logo', function(context) {
	hp.asset_logo(context, params.id);
});

action('square_small', function(context) {
	hp.asset_square(context, params.id, 150);
});

action('square_medium', function(context) {
	hp.asset_square(context, params.id, 300);
});

action('widescreen_small', function(context) {
	hp.asset_widescreen(context, params.id, 200);
});

action('widescreen_medium', function(context) {
	hp.asset_widescreen(context, params.id, 450);
});

action('backglass_small', function(context) {
	hp.asset_backglass(context, params.id, 150);
});

action('backglass_medium', function(context) {
	hp.asset_backglass(context, params.id, 600);
});
