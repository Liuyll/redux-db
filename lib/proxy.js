'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var net = require('net');
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
            const [host, port, path] = resolveURL(url);
            const httpOptions = Object.assign({ host,
                port,
                path, method: type, headers, 
                // 暂时只支持http
                protocol: 'http:' }, timeout ? { timeout } : {});
            const req = http.request(httpOptions, (res) => {
                let data = '';
                res.setEncoding('utf-8');
                if (pipe) {
                    res.pipe(pipe, { end: true });
                    res.on('end', () => {
                        resolve();
                    });
                }
                else {
                    res.on('data', (_data) => {
                        data += _data;
                    });
                    res.on('end', () => {
                        resolve({
                            status: res.statusCode,
                            data
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
                        checkStatus(successStatusRange, xhr.status) ? resolve(Object.assign(Object.assign({}, options.perf ? { __consumeTime: consume } : {}), { status: xhr.status, data: xhr.response })) : reject(Object.assign(Object.assign({}, options.perf ? { __consumeTime: consume } : {}), { status: xhr.status, errMsg: xhr.response }));
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
                return fetch(url, opts).then(r => handleResult(r))
                    .then(resolve)
                    .catch(reject);
            }
            function handleResult(res) {
                const handleContentTypeMap = {
                    'application/json': () => res.json(),
                    // 用以支持jsonp,不做任何处理
                    'application/javascript': () => JSONP_SUPPORT_RETURN,
                    'application/html': () => res.text(),
                    'application/text': () => res.text(),
                };
                if (successStatusRange ? checkStatus(successStatusRange, res.status) : res.ok) {
                    let ret = handleContentTypeMap[res.headers['contentType'] || res.headers['content-type']];
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
function resolveURL(url) {
    if (!url.endsWith('/'))
        url += '/';
    const match = /.*:\/\/(.*?)(?::)(.*)?\/(.*)/;
    const resolved = url.match(match);
    if (!resolved)
        throw Error('proxy url is not accord standard. example: http://host:port/path');
    return [resolved[1], resolved[2], resolved[3]];
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

function rexosProxyPlugin() {
    startServer();
}
rexosProxyPlugin.prototype.apply = function (compile) {
    compile.plugin('emit', (_, cb) => {
        cb();
    });
};

exports.rexosProxyPlugin = rexosProxyPlugin;
exports.startServer = startServer;
