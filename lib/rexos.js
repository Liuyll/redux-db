(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.rexos = {}));
}(this, (function (exports) { 'use strict';

  const ENV = typeof window === 'undefined' ? 'NODE' : 'BROWSER';
  const performance = ENV === 'NODE' ? null : window.performance;
  let DEV_PROXY_PORT = null;
  const JSONP_SUPPORT_RETURN = '__REDUX_DB_JSONP_SUPPORT';
  const BoundaryKey = "----rexos_boundary_node";
  function setDevProxyPort(port) {
      DEV_PROXY_PORT = port;
  }
  function ajax(options) {
      return new Promise((resolve, reject) => {
          let { data = {}, type, query = {}, url, agent } = options;
          if (!url)
              throw Error(`the url is missing! please check whether input url or options which include url.`);
          let sendData;
          const { withCredentials, headers = {}, cache = 'default', timeout, successStatusRange = [200, 300], cancelToken, 
          // add X-HTTP-Method-Override
          isXHMO, proxy, pipe, form } = options;
          let contentType;
          if (ENV === 'NODE') {
              contentType = headers['Content-Type'];
          }
          else {
              contentType = headers['Content-Type'] || (headers['Content-Type'] = data instanceof FormData
                  ? 'multipart/form-data'
                  : form ? 'application/x-www-form-urlencoded' : 'application/json');
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
              sendData = formatData(contentType, data);
          }
          if (isXHMO) {
              headers['X-HTTP-Method-Override'] = type;
          }
          if (ENV === 'NODE') {
              const http = require('http');
              if (agent == undefined)
                  agent = http.globalAgent;
              headers['accept-encoding'] = 'gzip, deflate';
              const httpOptions = Object.assign(Object.assign({ method: type, headers }, timeout ? { timeout } : {}), { agent });
              const req = http.request(url, httpOptions, (res) => {
                  if (pipe) {
                      pipe.set('Content-Type', 'application/octet-stream');
                      res.pipe(pipe, { end: true });
                      res.on('end', () => {
                          resolve(void 0);
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
              if (contentType === 'multipart/form-data')
                  buildMultipartFormDataOnNode(sendData, httpOptions, req);
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
              contentType !== 'multipart/form-data' && xhr.setRequestHeader('Content-Type', contentType);
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
                              let type = xhr.getResponseHeader('Content-Type') || "";
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
                              const handleGeneralType = (type) => {
                                  if (type.includes("application/json"))
                                      type = 'application/json';
                                  return type;
                              };
                              type = handleGeneralType(type);
                              return handleContentTypeMap[type] ? handleContentTypeMap[type]() : data.text();
                          };
                          checkStatus(successStatusRange, xhr.status) ? resolve(Object.assign(Object.assign({}, options.perf ? { __consumeTime: consume } : {}), { status: xhr.status, data: handleResult(xhr.response) })) : reject(Object.assign(Object.assign({}, options.perf ? { __consumeTime: consume } : {}), { status: xhr.status, errMsg: xhr.response }));
                          break;
                      }
                  }
              };
          }
          else {
              // form-data 由浏览器自行处理
              if (contentType === 'multipart/form-data')
                  delete headers['Content-Type'];
              const opts = Object.assign(Object.assign({ headers, method: type }, type !== 'GET' ? { body: sendData } : {}), { cache, credentials: handleCredentials(withCredentials) });
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
                  if (typeof URL !== 'undefined' && getCurrentOrigin(location.href) !== getCurrentOrigin(url)) {
                      opts.mode = 'cors';
                  }
                  return fetch(url, opts).then((res) => {
                      if (res.headers.get('Content-Type') == 'application/octet-stream') {
                          return readStream(res.body);
                      }
                      return res;
                  }).then(r => handleResult(r))
                      .then(resolve)
                      .catch(e => {
                      reject(e);
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
                      const handleGeneralType = (type) => {
                          if (type.includes("application/json"))
                              type = 'application/json';
                          return type;
                      };
                      const type = handleGeneralType(res.headers.get('contentType') || res.headers.get('content-type') || "");
                      const ret = handleContentTypeMap[type];
                      const data = ret && ret() || res.text();
                      return data.then(_data => {
                          return res['data'] = _data, res;
                      });
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
  function getCurrentOrigin(href) {
      try {
          return new URL(href).origin;
      }
      catch (e) {
          return Symbol('false');
      }
  }
  function buildMultipartFormDataOnNode(datas, options, req) {
      const boundary = '--' + BoundaryKey;
      const endBoundary = boundary + '--';
      options.headers['Content-Type'] = `multipart/form-data; boundary=${BoundaryKey}`;
      let body = boundary + '\r\n';
      for (const [key, value] of Object.entries(datas)) {
          body += (`Content-Disposition: form-data; name="${key}"` + '\r\n\r\n');
          body += value + '\r\n';
          body += boundary + '\r\n';
      }
      body += '\r\n';
      body += endBoundary;
      req.write(body);
  }

  function extend(target, exts, isDeep = false) {
      for (let ext in exts) {
          if (isDeep) {
              if (Object.prototype.hasOwnProperty.call(target, ext) && isObject(target[ext]) && isObject(exts[ext])) {
                  extend(target[ext], exts[ext], true);
                  continue;
              }
          }
          target[ext] = exts[ext];
      }
  }
  function isObject(t) {
      return Object.prototype.toString.call(t) === '[object Object]';
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
      isObject,
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
      // 添加baseUrl
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
          if (this.config.method) {
              this.config.type = this.config.method;
          }
          if (_.isArray(this.config)) {
              return DB.all(this.config);
          }
          // cdns
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
      static global(globalConfigs) {
          const extendConfig = (localConfigs) => {
              let globalConfigs2;
              try {
                  globalConfigs2 = JSON.parse(JSON.stringify(globalConfigs));
              }
              catch (err) {
                  throw Error(`global config must be object!`);
              }
              _.extend(globalConfigs2, localConfigs, true);
              return globalConfigs2;
          };
          this.interceptors.before.use(extendConfig, 'mergeGlobalConfigs');
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
          autoAddSchemaPrefix(this.config);
          return this.fetch(this.config).then(_ => {
              if (this.err)
                  throw this.err;
              // 拦截器调用的时机在回调之前,否则无法修改数据
              this.after(this.data);
              this.succeed();
              // 注意放入池子的时机,如果需要可以调用persist保持
              this.autoRelease && this.release();
              // 取出数据
              return this.data.__raw == undefined ? this.data : this.data.__raw;
          }).catch(err => {
              this.error(err);
              throw new FetchError(err.message, this.send, this.config.debug); // eslint-disable-line
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
          var _a, _b;
          try {
              delete this.data.__race_key_;
              (_b = (_a = this.config).succ) === null || _b === void 0 ? void 0 : _b.call(_a, this.data);
          }
          catch ({ message }) {
              try {
                  let ret = _.safeJsonParse(message);
                  if (ret['type'] === CONVERT_TO_FALSE)
                      this.error(ret);
              }
              catch (e) {
                  throw new Error(e.message);
              }
          }
      }
      error(err) {
          Array.isArray(this.config.err) && this.config.err.forEach(cb => {
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
              let data = r['data'];
              injectRaceKey(r);
              // 对本身就是string类型的返回值不进入任何处理
              // if(data['__transform'] === 'fail') data = data['__raw'] 
              if (transformData && typeof transformData === 'function') {
                  data = transformData(data);
                  r['data'] = data;
              }
              // 在注入race key之前缓存
              let key;
              if ((key = this.config.updateCache && this.config.updateCache.key)) {
                  window.localStorage.setItem(key, typeof data === 'object' ? _.safeJsonStringify(data) : data);
              }
              this.data = r;
              // injectRaceKey(data)
          }).catch((_err) => {
              let err;
              if (typeof _err !== 'object') {
                  err = Object.assign({ msg: _err }, _err === '__FETCH_CANCEL' ? { reason: 'request is canceled' } : {});
              }
              else
                  err = _err;
              // injectRaceKey(err)
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
  // 自动添加http前缀
  function autoAddSchemaPrefix(opts) {
      if (opts.rawUrl)
          return;
      const checkAndHandleUrl = (url) => /.*\/\//.test(url) ? url : 'http://' + url;
      if (opts.url) {
          opts.url = checkAndHandleUrl(opts.url);
      }
      else if (opts.urls) {
          opts.urls.forEach((url, i, urls) => {
              urls[i] = checkAndHandleUrl(url);
          });
      }
  }
  (function (DB) {
  })(DB || (DB = {}));
  class FetchError extends Error {
      constructor(msg, callee, debug = false) {
          super(msg);
          this.name = this.constructor.name;
          if (debug)
              return;
          Error.captureStackTrace && Error.captureStackTrace(this, callee ? callee : this.constructor);
      }
  }

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

  const startCheckPort = 25918;
  function useDB(...options) {
      let db;
      const autoFetch = options[0];
      if (autoFetch === true) {
          if (options[1].proxy && !DEV_PROXY_PORT) {
              return new Promise(resolve => {
                  checkProxyServerStart(() => {
                      db = getDB(options[1]);
                      resolve(db.execute());
                  });
              });
          }
          db = getDB(options[1]);
          return db.execute();
      }
      else {
          if (options[1].proxy && !DEV_PROXY_PORT) {
              return new Promise(resolve => {
                  checkProxyServerStart(() => {
                      db = getDB(autoFetch);
                      resolve(db);
                  });
              });
          }
          db = getDB(autoFetch);
          return db;
      }
  }
  function useFetch(options) {
      if (typeof options === 'string')
          options = {
              url: options
          };
      return useDB(true, options);
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
  function checkProxyServerStart(cb) {
      checkPort(startCheckPort, cb);
  }
  function checkPort(port, cb) {
      useFetch({
          url: `localhost:${port}/check`,
          timeout: 500,
      }).then(() => {
          setDevProxyPort(port);
          cb();
      }, () => {
          checkPort(port + 1, cb);
      });
  }
  function initWork() {
      initDbExts();
  }
  initWork();
  var DB$1 = DB;

  exports.DB = DB;
  exports.default = DB$1;
  exports.useDB = useDB;
  exports.useFetch = useFetch;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
