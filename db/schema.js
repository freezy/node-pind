/*
 db/schema.js contains database schema description for application models
 by default (when using jugglingdb as ORM) this file uses database connection
 described in config/database.json. But it's possible to use another database
 connections and multiple different schemas, docs available at

 http://railwayjs.com/orm.html

 Example of model definition:

 define('User', function () {
     property('email', String, { index: true });
     property('password', String);
     property('activated', Boolean, {default: false});
 });

 Example of schema configured without config/database.json (heroku redistogo addon):
 schema('redis', {url: process.env.REDISTOGO_URL}, function () {
     // model definitions here
 });

*/

describe('Table', function () {
    property('id', String);
    property('name', String);
    property('manufacturer', String);
    property('year', Number);
    property('type', String);
    property('platform', String);
    property('added', Date);
    property('updated', Date);
    property('enabled', Boolean);
    set('restPath', pathTo.tables);
});

describe('User', function () {
	property('user', String);
	property('pass', String);
	property('name', String);
	property('email', String);
	property('credits', Number);
	property('added', Date);
	property('updated', Date);
});
