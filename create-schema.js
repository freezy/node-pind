schema  = require('./app/models/schema');

schema.create(function(err){
	if (err){
		console.log('Unable to create schema: ' + err);
	} else {
		console.log('Schema created successfully.');
	}
});