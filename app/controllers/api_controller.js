load('application');
before(use('requireUser'));

var api = require('./app/modules/api')(app);

action('handle', function() {

	api.handle(req, res);
});
