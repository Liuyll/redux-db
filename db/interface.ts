export type RequestType = 'GET' | 'POST' | 'PUT' | 'get' | 'post' | 'put'
type CacheType = RequestCache

interface HeadersType {
    [header:string]:string
}

interface IUpdateCache {
    key:string
}

export type AjaxArgsType = {
    successStatusRange ?:[] | number,
    complete ?: () => void,
    fail ?: () => void,
    data ?:object,
    type ?:RequestType,
    query ?: object,
    url:string,
    'Content-Type' ?: string,
    'with-credentials' ?: boolean,
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
}

export type CustomMustType = Pick<AjaxArgsType,'url'>

export type StrictAjaxArgsType = {
    [k in keyof AjaxArgsType] -?: AjaxArgsType[k]
}

export type CustomOptionalType = Omit<AjaxArgsType,'url'>
