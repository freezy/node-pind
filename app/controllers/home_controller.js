load('application');
before(use('requireUser'));

action('index', function (context) {
	this.title = 'Welcome!';
	render();
});
