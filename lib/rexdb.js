'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const performance = window.performance;
const JSONP_SUPPORT_RETURN = '__REDUX_DB_JSONP_SUPPORT';
function ajax(options) {
    return new Promise((resolve, reject) => {
        let { data = {}, type, query = {}, url } = options;
        let sendData;
        const { withCredentials, headers = {}, cache = 'default', timeout, successStatusRange = [200, 300], cancelToken, 
        // add X-HTTP-Method-Override
        isXHMO } = options;
        const ContentType = headers['Content-Type'] || (headers['Content-Type'] = data instanceof FormData
            ? 'multipart/form-data'
            : 'application/x-www-form-urlencoded');
        if (cancelToken) {
            cancelToken(() => {
                reject('__FETCH_CANCEL');
            });
        }
        type = type.toUpperCase();
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
        if (typeof fetch === 'undefined') {
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

function extend(target, exts) {
    for (let ext in exts) {
        target[ext] = exts[ext];
    }
}
function isArray(t) {
    return Object.prototype.toString.call(t) === '[object Array]';
}
function safeJsonParse(target) {
    let ret;
    try {
        ret = JSON.parse(target);
    }
    catch (e) {
        ret = {
            __transform: 'fail',
            __raw: target
        };
    }
    return ret;
}
function safeJsonStringify(target) {
    let ret;
    try {
        ret = JSON.stringify(target);
    }
    catch (e) {
        ret = 'transform fail';
    }
    return ret;
}
function isSupportPreload() {
    return (document.createElement('link').relList &&
        document.createElement('link').relList.supports('preload'));
}
const _ = {
    isArray,
    extend,
    safeJsonParse,
    isSupportPreload,
    safeJsonStringify
};

const CONVERT_TO_FALSE = 'CONVERT_TO_FALSE';
const DBPools = [];
const SenderPools = [];
const DB_CONTAIN_COUNT = 10;
const SENDER_CONTAIN_COUNT = 10;
function extendConfigs(configs, ...exts) {
    for (let ext of exts) {
        for (let _ext in ext) {
            let _v = ext[_ext];
            if (!~['before', 'after', 'err'].indexOf(_ext))
                configs[_ext] = _v;
            else {
                _v = _v.pop ? _v : [_v];
                configs[_ext] && configs[_ext].pop ? (configs[_ext] = [].concat.call(configs[_ext], _v)) : (configs[_ext] = _v);
            }
        }
    }
    // TODO: 字符串解析有两次判断,改用正则匹配
    if (configs['baseUrl'] !== '' && configs['url']) {
        let url = configs['url'];
        let isHttp = url.indexOf('http://');
        let isHttps = url.indexOf('https://');
        if (!~isHttp) {
            let length = 'http://'.length;
            configs['url'] = configs['url'].substring(0, isHttp + length + 1) + configs['url'].substring(isHttp + length);
        }
        else if (!~isHttps) {
            let length = 'https://'.length;
            configs['url'] = configs['url'].substring(0, isHttps + length + 1) + configs['url'].substring(isHttps + length);
        }
    }
    return configs;
}
class DB {
    constructor(configs) {
        this.config = DB.configTransform(configs);
    }
    initConfig(configs) {
        this.config = DB.configTransform(configs);
    }
    /**
     * fetch
     * 兼容urls race | all发送
     */
    execute() {
        if (_.isArray(this.config)) {
            return DB.all(this.config);
        }
        if (this.config.urls) {
            let name = this.config.name;
            if (this.config.isCdnSelect && name) {
                let url;
                if ((url = window.sessionStorage.getItem(`__cdn_${name}`))) {
                    delete this.config['urls'];
                    this.config.url = url;
                    return getSender(this.config).send();
                }
            }
            let urls = this.config.urls;
            delete this.config['urls'];
            const fetchMap = urls.map(url => {
                this.config.url = url;
                return Object.assign({}, this.config);
            });
            return DB.race(fetchMap);
        }
        // ajax
        return getSender(this.config).send();
    }
    release() {
        if (DBPools.length >= DB_CONTAIN_COUNT) ;
        else {
            this.config = null;
            DBPools.push(this);
        }
    }
    /**
     * @static
     * @param {DbOpts} 传入参数
     * 将参数转化适配至DbConfigs
     * 扩展优先级:
     * 1. custom options
     * 2. extension options
     * 3. global defaults
     */
    static configTransform(configs) {
        return extendConfigs({
            before: [],
            after: [],
            err: [],
            type: configs.type ? configs.type : 'GET'
        }, this.defaults, this.options, configs);
    }
    static all(...requests) {
        let succ = [];
        let err = [];
        const noop = () => { };
        requests.forEach(r => {
            succ.push([r.succ]);
            err.push([r.err]);
            r.succ = noop;
            r.err = noop;
        });
        return Promise.all(requests.map(r => getDB(r).execute())).then(datas => {
            succ.forEach((cb, i) => cb && cb(datas[i]));
            return datas;
        }).catch((e) => {
            err.forEach(erc => erc && erc(e));
        });
    }
    static race(requests) {
        const succ = [];
        const err = [];
        const raceMap = new Map();
        const noop = () => { };
        requests.forEach((r, i) => {
            // TODO: 执行回调的错误捕获,不能让一个回调错误影响到后面的执行
            succ.push([r.succ]);
            err.push([r.err]);
            // if cdnselect -> cache url
            succ.forEach(s => s.unshift((__, url) => {
                let name = r.name;
                r.isCdnSelect && name && window.sessionStorage.setItem(`__cdn_${name}`, url);
            }));
            r.succ = noop;
            r.err = noop;
            const raceFlag = Symbol();
            r['__race_key_'] = raceFlag;
            raceMap.set(raceFlag, i);
        });
        function executeRaceCb(ret, type) {
            const { __race_key_ } = ret;
            const index = raceMap.get(__race_key_);
            // eslint-disable-next-line
            if (!index)
                return console.warn('after拦截器删除了内部RACE标识,请不要操作返回数据之外的键');
            type === 'succ' ? succ[index].forEach(cb => cb(ret, requests[index].url)) : err[index].forEach(cb => cb(ret));
        }
        return Promise.race(requests.map(r => getDB(r).execute())).then(data => {
            executeRaceCb(data, 'succ');
        }).catch((e) => {
            executeRaceCb(e, 'err');
        });
    }
    static extendConfigs(exts) {
        extendConfigs(this.options, exts);
    }
    /**
     *
     * @param stage 执行阶段
     * @param name 注册拦截器名
     * @param handle 拦截器执行方法
     * @param fail err拦截器
     */
    static addExtension(stage, name, handle, fail) {
        let conf = {}, enableKey = handle['enableKey'] || name + 'Enable';
        _.extend(conf, handle['option'] || {});
        if (stage === 'before') {
            conf[stage] = function (...args) {
                if (DB.options[enableKey]) {
                    if (args[0].bannerPlugins && args[0].bannerPlugins.includes(name))
                        return args[0];
                    return handle.apply(this, args);
                }
            };
        }
        if (stage === 'after') {
            conf[stage] = function (data) {
                let config = this.config;
                if (DB.options[enableKey]) {
                    if (config.bannerPlugins && config.bannerPlugins.includes(name))
                        return data;
                    return handle.call(this, data);
                }
            };
        }
        if (stage === 'after' && fail) {
            conf['err'] = function (err) {
                let config = this.config;
                if (DB.options[enableKey]) {
                    if (config.bannerPlugins && config.bannerPlugins.includes(name))
                        return;
                    return fail.call(this, err);
                }
            };
        }
        this.extendConfigs(conf);
    }
    static closePlugin(name, enableKey = 'Enable') {
        const t = name + enableKey;
        this.options[t] = false;
    }
    static startPlugin(name, enableKey = 'Enable') {
        const t = name + enableKey;
        this.options[t] = true;
    }
}
DB.defaults = {
    baseUrl: ''
};
DB.options = {};
class Sender {
    constructor(config) {
        this.autoRelease = false;
        this.config = null;
        this.data = null;
        this.err = null;
        this.responseText = '';
        this.responseStatus = '';
        this.config = config;
    }
    initConfig(config) {
        this.config = config;
    }
    persist() {
        this.autoRelease = false;
    }
    send() {
        this.config = this.before(this.config);
        return this.fetch(this.config).then(_ => {
            if (this.err)
                throw this.err;
            // 拦截器调用的时机在回调之前,否则无法修改数据
            this.after(this.data);
            this.succeed();
            // 注意放入池子的时机,如果需要可以调用persist保持
            this.autoRelease && this.release();
            return this.data;
        }).catch(err => {
            this.error(err);
            throw err;
        });
    }
    before(config) {
        return config.before ? config.before.reduce((_config, cb) => {
            try {
                return cb(_config);
            }
            catch (e) {
                console.error(`
                    before拦截器发生错误,error:${e}
                `);
                throw e;
            }
        }, config) : config;
    }
    // transform data before processSucc callback
    after(data) {
        this.data = this.config.after.length ? this.config.after.reduce((_data, cb) => {
            if (_.isArray(_data) && _data[0] === CONVERT_TO_FALSE)
                throw new Error(JSON.stringify({
                    type: CONVERT_TO_FALSE,
                    reason: _data[1]
                }));
            return cb.call(this, _data);
        }, data) : data;
    }
    succeed() {
        try {
            let data = Object.assign({}, this.data);
            delete data.__race_key_;
            this.data = data;
            this.config.succ(data);
        }
        catch ({ message }) {
            try {
                let ret = _.safeJsonParse(message);
                if (ret['type'] === CONVERT_TO_FALSE)
                    this.error(ret);
            }
            catch (e) {
                new Error(e.message);
            }
        }
    }
    error(err) {
        this.config.err && this.config.err.forEach(cb => {
            cb.call(this, err);
        });
    }
    /**
     * 职责:
     * 1. 调用内部ajax库
     * 2. 执行用户提供的transformData,这是用户最先接触到返回数据的地方
     * 3. 根据策略缓存数据
     * 4. 注入race所需要的key
     */
    fetch(opts) {
        const extendOpt = {
            complete() { }
        };
        /**
        * 注入race_key
        * 否则race执行时无法知道成功的位置
        */
        const injectRaceKey = data => {
            _.extend(data, {
                __race_key_: this.config['__race_key_']
            });
        };
        return ajax(Object.assign(Object.assign({}, opts), extendOpt)).then(r => {
            let { transformData } = this.config;
            let data = _.safeJsonParse(r);
            // 对本身就是string类型的返回值不进入任何处理
            if (data['__transform'] === 'fail')
                data = data['__raw'];
            if (transformData && typeof transformData === 'function') {
                r = transformData(r);
            }
            // 在注入race key之前缓存
            let key;
            if ((key = this.config.updateCache && this.config.updateCache.key)) {
                window.localStorage.setItem(key, typeof data === 'object' ? _.safeJsonStringify(data) : data);
            }
            injectRaceKey(data);
            this.data = data;
        }).catch((_err) => {
            let err;
            if (typeof _err !== 'object') {
                err = Object.assign({ msg: _err }, _err === '__FETCH_CANCEL' ? { reason: 'request is canceled' } : {});
            }
            else
                err = _err;
            injectRaceKey(err);
            this.err = err;
        });
    }
    release() {
        if (SenderPools.length >= SENDER_CONTAIN_COUNT) ;
        else {
            this.config = null;
            this.data = null;
            this.responseText = null;
            this.responseStatus = null;
            SenderPools.push(this);
        }
    }
}
function getSender(opts) {
    if (SenderPools.length) {
        let sender = SenderPools.pop();
        sender.initConfig(opts);
        return sender;
    }
    else {
        const useSender = new Sender(opts);
        return useSender;
    }
}
function getDB(opts) {
    if (DBPools.length) {
        let db = DBPools.pop();
        db.initConfig(opts);
        return db;
    }
    else {
        const useDb = new DB(opts);
        return useDb;
    }
}
(function (DB) {
})(DB || (DB = {}));

const dbExts = {
    before: {},
    after: {}
};
function useInterceptor(stage, name, interceptor, fail) {
    DB.addExtension(stage, name, interceptor, fail);
    DB.startPlugin(name);
}
const SenderInterceptors = {
    interceptors: {
        before: {
            use(interceptor, name) {
                useInterceptor('before', name, interceptor);
            }
        },
        after: {
            use(interceptor, name, fail) {
                useInterceptor('after', name, interceptor, fail);
            }
        }
    }
};
_.extend(DB, {
    interceptors: SenderInterceptors.interceptors
});

function useDB(...options) {
    let db;
    const autoFetch = options[0];
    if (typeof autoFetch === 'boolean') {
        db = getDB(options[1]);
        return db.execute();
    }
    else {
        db = getDB(autoFetch);
        return db;
    }
}
function initDbExts() {
    for (let stage in dbExts) {
        let handles = dbExts[stage];
        for (let name in handles) {
            DB.addExtension(stage, name, handles[name]);
            DB.startPlugin(name);
        }
    }
}
function initWork() {
    initDbExts();
}
initWork();

exports.DB = DB;
exports.useDB = useDB;
