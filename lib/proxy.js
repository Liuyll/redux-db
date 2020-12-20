'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var child_process = require('child_process');
var net = require('net');
var path = require('path');

const startPort = 25918;
function detectPort(port) {
    return new Promise((resolve, reject) => {
        let server = net.createServer().listen(port);
        server.on('listening', function () {
            server.close();
            resolve(port);
        });
        server.on('error', function (err) {
            if (err['code'] == 'EADDRINUSE') {
                port++;
                reject(err);
            }
        });
    });
}
const tryUsePort = function (port, _portAvailableCallback) {
    detectPort(port).then((port) => {
        _portAvailableCallback(port);
    }).catch((err) => {
        port++;
        tryUsePort(port, _portAvailableCallback);
    });
};
function startServer() {
    tryUsePort(startPort, (port) => {
        const server = child_process.fork(path.resolve(__dirname, 'proxy'));
        server.send(port);
    });
}

function rexosProxyPlugin() {
    startServer();
}
rexosProxyPlugin.prototype.apply = function (compile) {
    console.log('qqqqqqqqqqqqqqqqqqqqqq');
    compile.plugin('emit', (_, cb) => {
        console.log('rexos-proxy server has start');
        cb();
    });
};

exports.rexosProxyPlugin = rexosProxyPlugin;
exports.startServer = startServer;
