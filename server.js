#!/usr/bin/env node

var settings = require('./config/settings');

/**
 * Server module exports method which returns new instance of application server
 *
 * @param {Object} params - railway/express webserver initialization params.
 * @returns CompoundJS powered express webserver
 */
var app = module.exports = function getServerInstance(params) {
    params = params || {};
    // specify current dir as default root of server
    params.root = params.root || __dirname;
    return require('compound').createServer(params);
};

if (!module.parent) {
    var port = settings.pind.port;
    var host = process.env.HOST || '0.0.0.0';

    var server = app();
    server.listen(port, host, function () {
        console.log(
            'Pind server listening on %s:%d within %s environment',
            host, port, server.set('env')
        );
    });
}

