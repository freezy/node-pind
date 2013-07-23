$("a[rel=popover]").popover();
$("a[rel=tooltipRight]").tooltip({placement: "right"});
$("a[rel=tooltip]").tooltip();

ss.server.on('disconnect', function() {
	console.log('Connection down :-(');
});

ss.server.on('reconnect', function() {
	console.log('Connection back up :-)');
});