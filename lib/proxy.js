'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var child_process = require('child_process');
var net = require('net');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var process = require('process');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var express__default = /*#__PURE__*/_interopDefaultLegacy(express);
var process__default = /*#__PURE__*/_interopDefaultLegacy(process);

const ENV = typeof window === 'undefined' ? 'NODE' : 'BROWSER';
const performance = ENV === 'NODE' ? null : window.performance;
let DEV_PROXY_PORT = null;
const JSONP_SUPPORT_RETURN = '__REDUX_DB_JSONP_SUPPORT';
function ajax(options) {
    return new Promise((resolve, reject) => {
        let { data = {}, type, query = {}, url } = options;
        if (!url)
            throw Error(`the url is missing! please check whether input url or options which include url.`);
        let sendData;
        const { withCredentials, headers = {}, cache = 'default', timeout, successStatusRange = [200, 300], cancelToken, 
        // add X-HTTP-Method-Override
        isXHMO, proxy, pipe } = options;
        let ContentType;
        if (ENV === 'NODE') {
            ContentType = headers['Content-Type'];
        }
        else {
            ContentType = headers['Content-Type'] || (headers['Content-Type'] = data instanceof FormData
                ? 'multipart/form-data'
                : 'application/x-www-form-urlencoded');
        }
        if (cancelToken) {
            cancelToken(() => {
                reject('__FETCH_CANCEL');
            });
        }
        type = type.toUpperCase();
        if (proxy) {
            data['origin'] = url;
            data['method'] = type;
            url = getDevProxyUrl();
            type = 'POST';
        }
        if (type === 'GET') {
            query = Object.assign(Object.assign({}, data), query);
            if (Object.keys(data).length && Object.keys(query).length)
                url = handleQuery(url, query);
        }
        else {
            sendData = formatData(ContentType, data);
        }
        if (isXHMO) {
            headers['X-HTTP-Method-Override'] = type;
        }
        if (ENV === 'NODE') {
            const http = require('http');
            headers['accept-encoding'] = 'gzip, deflate';
            const httpOptions = Object.assign({ method: type, headers }, timeout ? { timeout } : {});
            const req = http.request(url, httpOptions, (res) => {
                if (pipe) {
                    pipe.set('Content-Type', 'application/octet-stream');
                    res.pipe(pipe, { end: true });
                    res.on('end', () => {
                        resolve();
                    });
                }
                else {
                    let data = Buffer.alloc(0);
                    res.on('data', (_data) => {
                        data = Buffer.concat([data, _data]);
                    });
                    res.on('end', () => {
                        // deflate
                        new Promise(resolve => {
                            if (res.headers['content-encoding'] === 'gzip') {
                                const zlib = require('zlib');
                                zlib.gunzip(data, (err, decoded) => {
                                    if (err)
                                        reject(`decompress gzip err!
message:${err.message}`);
                                    resolve(decoded);
                                });
                            }
                            else
                                resolve(data);
                        }).then(data => {
                            let _data = data.toString();
                            if (res.headers['content-type'] === 'application/json') {
                                _data = JSON.parse(_data);
                            }
                            resolve({
                                status: res.statusCode,
                                data: _data
                            });
                        });
                    });
                }
            });
            req.end();
        }
        else if (typeof fetch === 'undefined') {
            let xhr = new XMLHttpRequest();
            xhr.open(type, url, true);
            for (let header in headers) {
                xhr.setRequestHeader(header, headers[header]);
            }
            if (timeout)
                xhr.timeout = timeout;
            xhr.withCredentials = withCredentials;
            // 不为multipart/form-data设置c-t
            ContentType !== 'multipart/form-data' && xhr.setRequestHeader('Content-Type', ContentType ? ContentType : type === 'POST' ? 'application/x-www-form-urlencoded' : 'application/json');
            xhr.send(type === 'GET' ? '' : sendData);
            xhr.ontimeout = () => {
                reject({
                    status: null,
                    errMsg: 'timeout'
                });
            };
            xhr.onreadystatechange = function () {
                let requestPerfStart;
                switch (xhr.readyState) {
                    case XMLHttpRequest.OPENED: {
                        requestPerfStart = performance.now();
                        break;
                    }
                    case XMLHttpRequest.DONE: {
                        let consume = performance.now() - requestPerfStart;
                        const handleResult = (data) => {
                            const type = xhr.getResponseHeader('Content-Type');
                            const handleContentTypeMap = {
                                'application/json': () => data.json(),
                                // 用以支持jsonp,不做任何处理
                                'application/javascript': () => JSONP_SUPPORT_RETURN,
                                'application/html': () => data.text(),
                                'application/text': () => data.text(),
                                'application/octet-stream': () => data.blob(),
                                'text/html': () => data.text(),
                                'text/plain': () => data.text(),
                                'image/png': () => data.blob()
                            };
                            return handleContentTypeMap[type] ? handleContentTypeMap[type]() : data.text();
                        };
                        checkStatus(successStatusRange, xhr.status) ? resolve(Object.assign(Object.assign({}, options.perf ? { __consumeTime: consume } : {}), { status: xhr.status, data: handleResult(xhr.response) })) : reject(Object.assign(Object.assign({}, options.perf ? { __consumeTime: consume } : {}), { status: xhr.status, errMsg: xhr.response }));
                        break;
                    }
                }
            };
        }
        else {
            const opts = Object.assign(Object.assign({ headers, method: type }, type !== 'GET' ? { body: sendData } : {}), { cache, credentials: handleCredentials(withCredentials) });
            if (ContentType === 'multipart/form-data')
                delete headers['Content-Type'];
            if (timeout) {
                if (typeof AbortController !== 'undefined') {
                    const controller = new AbortController();
                    opts['signal'] = controller.signal;
                    fetchAndHandle();
                    setTimeout(() => {
                        controller.abort();
                        reject('fetch timeout');
                    }, timeout);
                }
                else {
                    Promise.race([
                        fetchAndHandle(),
                        new Promise(_ => {
                            setTimeout(() => reject('fetch timeout'), timeout);
                        })
                    ]);
                }
            }
            else
                fetchAndHandle();
            function fetchAndHandle() {
                if (proxy)
                    opts.mode = 'cors';
                return fetch(url, opts).then((res) => {
                    if (res.headers.get('Content-Type') == 'application/octet-stream') {
                        return readStream(res.body);
                    }
                    return res;
                }).then(r => handleResult(r))
                    .then(resolve)
                    .catch(() => {
                    debugger;
                    reject();
                });
            }
            function handleResult(res) {
                const handleContentTypeMap = {
                    'application/json': () => res.json(),
                    // 用以支持jsonp,不做任何处理
                    'application/javascript': () => JSONP_SUPPORT_RETURN,
                    'application/html': () => res.text(),
                    'application/text': () => res.text(),
                    'text/html': () => res.text(),
                    'text/plain': () => res.text()
                };
                if (successStatusRange ? checkStatus(successStatusRange, res.status) : res.ok) {
                    let ret = handleContentTypeMap[res.headers.get('contentType') || res.headers.get('content-type')];
                    return ret && ret() || res.text();
                }
                else {
                    const error = {
                        state: 'fail',
                        status: res.status,
                    };
                    throw new Error(JSON.stringify(error));
                }
            }
        }
    });
}
function readStream(readerStream) {
    const reader = readerStream.getReader();
    const stream = new ReadableStream({
        start(controller) {
            const _read = () => {
                reader.read().then(({ done, value }) => {
                    if (done)
                        return controller.close();
                    controller.enqueue(value);
                    _read();
                });
            };
            _read();
        }
    });
    return new Response(stream);
}
// TODO: 支持strict模式
function handleCredentials(opt, none = true) {
    // chrome 最新版本要求same-site:lax(不发送绝大多数第三方cookie)
    // 可手动设置为include(None)或Strict
    if (opt)
        return none ? 'include' : 'same-origin';
    else
        return 'omit';
}
function handleQuery(url, query) {
    return url + '?' + formatKV(query);
}
function checkStatus(range, status) {
    if (range && range.pop) {
        if (status >= range[0] && status < range[1])
            return true;
    }
    return range === status ? true : false;
}
function formatData(type, data) {
    let r;
    switch (type) {
        case 'multipart/form-data': {
            if (data instanceof FormData) {
                r = data;
                break;
            }
            r = new FormData();
            Object.keys(data).forEach(key => {
                r.append(key, data[key]);
            });
            break;
        }
        case 'application/x-www-form-urlencoded': {
            r = formatKV(data);
            break;
        }
        default:        case 'application/json': {
            r = JSON.stringify(data);
        }
    }
    return r;
}
function formatKV(data) {
    let r = '';
    for (let k in data) {
        r += `${k}=${data[k]}&`;
    }
    return r.substring(0, r.length - 1);
}
function getDevProxyUrl() {
    return `http://localhost:${DEV_PROXY_PORT}/proxy`;
}

const app = express__default['default']();
app.use((req, res, next) => {
    res.set({
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Headers': 'X-Requested-With,Content-Type',
        'Access-Control-Allow-Methods': 'PUT,POST,GET,DELETE,OPTIONS',
        'Access-Control-Expose-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8'
    });
    req.method === 'OPTIONS' ? res.status(204).end() : next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
function proxy(req, res) {
    const { origin, method } = req.body;
    const requestOptions = {
        url: origin,
        type: method,
        headers: req.headers,
        pipe: res
    };
    ajax(requestOptions).then(() => {
        res.end();
    }, err => {
        res.status(500);
        res.write('Proxy error: retry!');
        res.end();
    });
}
function check(req, res) {
    res.send('normal');
}
app.post('/proxy', proxy);
app.get('/check', check);
process__default['default'].on('message', (port) => {
    app.listen(port);
});
function startProxy(port) {
    console.log('success: rexos proxy server is start!'); // eslint-disable-line
    app.listen(port);
}

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
        startProxy(port);
    });
}
function forkServer() {
    tryUsePort(startPort, (port) => {
        const server = child_process.fork(path.resolve(__dirname, 'proxy'), { stdio: 'ignore', detached: true });
        server.send(port);
        // protectServer(server)
    });
}

function rexosProxyPlugin() {
    startServer();
}
rexosProxyPlugin.prototype.apply = function (compile) {
    compile.plugin('emit', (_, cb) => {
        cb();
    });
};

exports.forkServer = forkServer;
exports.rexosProxyPlugin = rexosProxyPlugin;
exports.startServer = startServer;
