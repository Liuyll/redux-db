const ENV = typeof window === 'undefined' ? 'NODE' : 'BROWSER'
const performance = ENV === 'NODE' ? null : window.performance
import { AjaxArgsType, RequestType } from './interface'

export let DEV_PROXY_PORT = null
const JSONP_SUPPORT_RETURN = '__REDUX_DB_JSONP_SUPPORT'
const BoundaryKey = "----rexos_boundary_node"

export function setDevProxyPort(port) {
    DEV_PROXY_PORT = port
}

export function ajax(options:AjaxArgsType) {
    return new Promise((resolve,reject) => {
        let { data = {},type,query = {},url, agent } = options
        if(!url) throw Error(`the url is missing! please check whether input url or options which include url.`)
        let sendData:string 
        const {
            withCredentials,
            headers = {},
            cache = 'default',
            timeout,
            successStatusRange = [200,300],
            cancelToken,
            // add X-HTTP-Method-Override
            isXHMO,
            proxy,
            pipe,
            form
        } = options

        let contentType
        if(ENV === 'NODE') {
            contentType = headers['Content-Type']
        } else {
            contentType = headers['Content-Type'] || (
                headers['Content-Type'] = data instanceof FormData 
                    ? 'multipart/form-data' 
                    : form ? 'application/x-www-form-urlencoded' : 'application/json'
            )
        }

        if(cancelToken) {
            cancelToken(() => {
                reject('__FETCH_CANCEL')
            })    
        }

        type = type.toUpperCase() as RequestType

        if(proxy) {
            data['origin'] = url 
            data['method'] = type
            url = getDevProxyUrl()
            type = 'POST'
        } 

        if(type === 'GET') {
            query = {
                ...data,
                ...query
            }
            if(Object.keys(data).length && Object.keys(query).length) url = handleQuery(url,query)
        } else {
            sendData = formatData(contentType,data)
        } 

        if(isXHMO) {
            headers['X-HTTP-Method-Override'] = type
        }

        if(ENV === 'NODE') {
            const http = require('http')
            if(agent == undefined) agent = http.globalAgent
            headers['accept-encoding'] = 'gzip, deflate'
            const httpOptions = {
                method: type,
                headers,
                ...timeout ? { timeout } : {},
                agent
            }

            const req = http.request(url, httpOptions,(res) => {
                if(pipe) {
                    pipe.set('Content-Type', 'application/octet-stream')
                    res.pipe(pipe, { end: true })
                    res.on('end', () => {
                        resolve(void 0)
                    })
                } else {
                    let data = Buffer.alloc(0)
                    res.on('data', (_data) => {
                        data = Buffer.concat([data, _data])
                    })
                    res.on('end', () => {
                        // deflate
                        new Promise(resolve => {
                            if(res.headers['content-encoding'] === 'gzip') {
                                const zlib = require('zlib')
                                zlib.gunzip(data, (err, decoded) => {
                                    if(err) reject(`decompress gzip err!
message:${err.message}`)
                                    resolve(decoded)
                                })
                            }
                            else resolve(data)
                        }).then(data => {
                            let _data = data.toString()
                            if(res.headers['content-type'] === 'application/json') {
                                _data = JSON.parse(_data)
                            }
                            resolve({
                                status: res.statusCode,
                                data: _data
                            })
                        })
                    })
                }
            })

            if(contentType === 'multipart/form-data') buildMultipartFormDataOnNode(sendData, httpOptions, req)
            req.end()
        } else if(typeof fetch === 'undefined') {
            let xhr = new XMLHttpRequest()
            xhr.open(type,url,true)
            for(let header in headers) {
                xhr.setRequestHeader(header,headers[header])
            }

            if(timeout) xhr.timeout = timeout
            xhr.withCredentials = withCredentials

            // 不为multipart/form-data设置c-t
            contentType !== 'multipart/form-data' && xhr.setRequestHeader('Content-Type',contentType)
            xhr.send(type === 'GET' ? '' : sendData) 
            xhr.ontimeout = () => {
                reject({
                    status: null,
                    errMsg: 'timeout'
                })
            }

            xhr.onreadystatechange = function() {
                let requestPerfStart
                switch (xhr.readyState) {
                case XMLHttpRequest.OPENED: {
                    requestPerfStart = performance.now()
                    break
                }
                case XMLHttpRequest.DONE: {
                    let consume = performance.now() - requestPerfStart

                    const handleResult = (data) => {
                        let type = xhr.getResponseHeader('Content-Type') || ""

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
                        }

                        const handleGeneralType = (type) => {
                            if(type.includes("application/json")) type = 'application/json'
                            return type
                        }
                        type = handleGeneralType(type)
                        return handleContentTypeMap[type] ? handleContentTypeMap[type]() : data.text()
                    }
                    
                    checkStatus(successStatusRange,xhr.status) ? resolve({
                        ... options.perf ? { __consumeTime: consume } : {},
                        status: xhr.status,
                        data: handleResult(xhr.response)
                    }) : reject({
                        ... options.perf ? { __consumeTime: consume } : {},
                        status: xhr.status,
                        errMsg: xhr.response
                    })
                    break
                }
                }
            }
        } else {
            // form-data 由浏览器自行处理
            if(contentType === 'multipart/form-data') delete headers['Content-Type']

            const opts:RequestInit = {
                headers,
                method: type,
                ... type !== 'GET' ? { body: sendData } : {},
                cache,
                credentials: handleCredentials(withCredentials)
            }


            if(timeout) {
                if(typeof AbortController !== 'undefined') {
                    const controller = new AbortController()
                    opts['signal'] = controller.signal
                    fetchAndHandle()

                    setTimeout(() => {
                        controller.abort()
                        reject('fetch timeout')
                    },timeout)
                } 
                else {
                    Promise.race([
                        fetchAndHandle(),
                        new Promise(_ => {
                            setTimeout(() => reject('fetch timeout'),timeout)
                        })
                    ])
                }
            } else fetchAndHandle()

            function fetchAndHandle():Promise<unknown> {
                if(typeof URL !== undefined && getCurrentOrigin(location.href) !== getCurrentOrigin(url)) {
                    opts.mode = 'cors'
                }
                return fetch(url,opts).then((res: Response) => {
                    if(res.headers.get('Content-Type') == 'application/octet-stream') {
                        return readStream(res.body)
                    }
                    return res
                }).then(r => handleResult(r))
                    .then(resolve)
                    .catch(e => {
                        reject(e)
                    })
            }

            function handleResult(res:Response) {
                const handleContentTypeMap = {
                    'application/json': () => res.json(),
                    // 用以支持jsonp,不做任何处理
                    'application/javascript': () => JSONP_SUPPORT_RETURN,
                    'application/html': () => res.text(),
                    'application/text': () => res.text(),
                    'text/html': () => res.text(),
                    'text/plain': () => res.text()
                }
                
                if(successStatusRange ? checkStatus(successStatusRange,res.status) : res.ok) {
                    const handleGeneralType = (type) => {
                        if(type.includes("application/json")) type = 'application/json'
                        return type
                    }
                    const type = handleGeneralType(res.headers.get('contentType') || res.headers.get('content-type') || "") 
                    const ret = handleContentTypeMap[type]
                    const data = ret && ret() || res.text()
                    return data.then(_data => {
                        return res['data'] = _data, res
                    })
                } else {
                    const error = {
                        state: 'fail',
                        status: res.status,
                    }
  
                    throw new Error(JSON.stringify(error))
                }
            }
        }
    })
}

function readStream(readerStream: ReadableStream): Response {
    const reader = readerStream.getReader()
    const stream = new ReadableStream({
        start(controller) {
            const _read = () => {
                reader.read().then(({ done, value }) => {
                    if(done) return controller.close()
                    controller.enqueue(value)
                    _read()
                })
            }

            _read()
        }
    })
    
    return new Response(stream)
}

// TODO: 支持strict模式
function handleCredentials(opt:boolean,none:boolean = true):RequestCredentials {
    // chrome 最新版本要求same-site:lax(不发送绝大多数第三方cookie)
    // 可手动设置为include(None)或Strict
    if(opt) return none ? 'include' : 'same-origin'
    else return 'omit'
}

function handleQuery(url:string,query:object):string {
    return url + '?' + formatKV(query)
}

function checkStatus(range,status):boolean {
    if(range && (range as []).pop) {
        if(status >= range[0] && status < range[1]) return true
    } 
    return range === status ? true : false
}

function formatData(type:string,data:object):string{
    let r 
    switch(type) {
    case 'multipart/form-data': {
        if(data instanceof FormData) {
            r = data
            break
        }

        r = new FormData()
        Object.keys(data).forEach(key => {
            r.append(key,data[key])
        })
            
        break
    }
    case 'application/x-www-form-urlencoded' :{
        r = formatKV(data)
        break
    } 
    default: {}
    case 'application/json': {
        r = JSON.stringify(data)
    }
    }

    return r
}

function formatKV(data:object) {
    let r = ''
    for(let k in data) {
        r += `${k}=${data[k]}&`
    }
    return r.substring(0,r.length - 1)
}

function getDevProxyUrl() {
    return `http://localhost:${DEV_PROXY_PORT}/proxy`
}

function getCurrentOrigin(href) {
    return new URL(href).origin
}

function buildMultipartFormDataOnNode(datas, options, req) {
    const boundary = '--' + BoundaryKey
    const endBoundary = boundary + '--'
    options.headers['Content-Type'] =  `multipart/form-data; boundary=${BoundaryKey}`

    let body = boundary + '\r\n'
    for(const [key, value] of Object.entries(datas)) {
        body += (`Content-Disposition: form-data; name="${key}"` + '\r\n\r\n')
        body += value + '\r\n'
        body += boundary + '\r\n'
    }

    body += '\r\n' 
    body += endBoundary

    req.write(body)
}