load('application');
before(use('requireAdmin'));

action('index', function (context) {
	this.title = 'Settings';
	render();
});