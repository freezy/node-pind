load('application');
before(use('requireUser'));

action('index', function (context) {
	this.title = 'Welcome!';
	render();
});

action('tables', function(context) {
	this.title = 'Tables';
	Table.all(function(err, rows) {
		for (var i = 0; i < rows.length; i++) {
			rows[i]['banner'] = pathTo.asset_banner(rows[i].key);
		}
		render({ tables : rows });
	});

})
