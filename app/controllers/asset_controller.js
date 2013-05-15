load('application');
before(use('requireUser'));

var util = require('util');
var asset = require('./app/modules/asset');

action('banner', function(context) {
	asset.banner(context, params.id);
});

action('banner_small', function(context) {
	asset.banner(context, params.id, 655);
});

action('portrait_small', function(context) {
	asset.table(context, params.id, 350);
});

action('portrait_medium', function(context) {
	asset.table(context, params.id, 800);
});

action('logo', function(context) {
	asset.logo(context, params.id);
});

action('square_small', function(context) {
	asset.square(context, params.id, 150);
});

action('square_medium', function(context) {
	asset.square(context, params.id, 300);
});

action('widescreen_small', function(context) {
	asset.widescreen(context, params.id, 200);
});

action('widescreen_medium', function(context) {
	asset.widescreen(context, params.id, 450);
});

action('backglass_small', function(context) {
	asset.backglass(context, params.id, 150);
});

action('backglass_medium', function(context) {
	asset.backglass(context, params.id, 600);
});
