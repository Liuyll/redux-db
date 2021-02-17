export declare type RequestType = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'get' | 'post' | 'put' | 'delete' | 'head' | 'options';
declare type CacheType = RequestCache;
interface HeadersType {
    [header: string]: string;
}
interface IUpdateCache {
    key: string;
}
interface IUrl {
    urls?: string[];
    url?: string;
    rawUrl?: boolean;
}
export declare type AjaxArgsType = {
    url: string;
    successStatusRange?: [] | number;
    data?: object;
    type?: RequestType;
    method?: RequestType;
    query?: object;
    withCredentials?: boolean;
    headers?: HeadersType;
    cache?: CacheType;
    timeout?: number;
    perf?: boolean;
    transformData?: Function;
    cancelToken?: (acceptCancel: unknown) => void;
    updateCache?: IUpdateCache;
    bannerPlugins?: string[];
    isXHMO?: boolean;
    proxy?: boolean;
    pipe?: any;
    form?: boolean;
    agent?: Object | boolean;
};
export declare type CustomMustType = Pick<AjaxArgsType, 'url'>;
export declare type StrictAjaxArgsType = {
    [k in keyof AjaxArgsType]-?: AjaxArgsType[k];
};
export declare type CustomOptionalType = Omit<AjaxArgsType, 'url'>;
declare type Port = String;
declare type Host = String;
declare type Path = String;
export declare type URLResolve = [Port, Host, Path];
export { IUrl, };
