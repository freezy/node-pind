load('application');
before(use('requireUser'));

action('index', function (context) {
	render();
});
