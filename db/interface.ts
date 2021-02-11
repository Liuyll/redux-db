export type RequestType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'get' | 'post' | 'put' | 'delete' | 'head' | 'options'
type CacheType = RequestCache

interface HeadersType {
    [header:string]:string
}

interface IUpdateCache {
    key:string
}

interface IUrl {
    urls ?: string[]
    url ?: string,
    rawUrl ?: boolean
}

export type AjaxArgsType = {
    url:string,
    successStatusRange ?:[] | number,
    data ?:object,
    type ?:RequestType,
    method ?: RequestType,
    query ?: object,
    // DB.race | DB.all
    // 'Content-Type' ?: string,
    withCredentials ?: boolean,
    headers ?:HeadersType,
    cache ?: CacheType,
    timeout ?: number,
    // 是否开启请求耗时计算
    perf ?: boolean,
    transformData ?: Function,
    cancelToken ?: (acceptCancel:unknown) => void,
    updateCache ?: IUpdateCache,
    // 本次请求关闭插件
    bannerPlugins ?: string[],
    // X-HTTP-Method-Override
    isXHMO ?: boolean,
    proxy ?: boolean,
    pipe ?: any
    form ?: boolean,
    agent ?: Object | boolean
}

export type CustomMustType = Pick<AjaxArgsType,'url'>

export type StrictAjaxArgsType = {
    [k in keyof AjaxArgsType] -?: AjaxArgsType[k]
}

export type CustomOptionalType = Omit<AjaxArgsType,'url'>

type Port = String
type Host = String
type Path = String
export type URLResolve = [Port, Host, Path]

export {
    IUrl,
}