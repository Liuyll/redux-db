import { CustomMustType, CustomOptionalType } from './interface';
export declare const CONVERT_TO_FALSE = "CONVERT_TO_FALSE";
interface IDB extends IPool<DB> {
    execute: (args: unknown[]) => any;
}
interface ISenderHooks {
    before(config: SenderOpts): SenderOpts;
    after(data: unknown): any;
}
interface ISender extends ISenderHooks, IPool<Sender>, ControlledPool {
    send(): any;
    succeed(): any;
    error(e: any): any;
    fetch(opts: CustomMustType): any;
}
interface ControlledPool {
    autoRelease: boolean;
    persist(): void;
}
interface IPool<T> {
    release(): any;
    initConfig(config: T extends DB ? DbOpts : SenderOpts): any;
}
declare type Before = (config: SenderOpts) => SenderOpts;
declare type After = (data: unknown) => any;
/**
 * succ和err接口将不被redux-db支持
 * DB类将作为抽象层兼容@tencent/db
 */
export declare type DbOpts = {
    name?: string;
    url?: string;
    urls?: string[];
    isCdnSelect?: boolean;
    succ?: Function;
    err?: Function;
    before?: Before[];
    after?: After[];
    rawUrl?: boolean;
} & CustomOptionalType;
export declare type SenderOpts = {
    before?: Before[];
    after?: After[];
} & DbConfigs;
declare type DbConfigs = Omit<DbOpts, 'err'> & {
    err: Function[];
};
interface DBDefaultsConfig {
    baseUrl?: string;
    withCredentials?: boolean;
    withBrowserCache?: boolean;
}
export declare class DB implements IDB {
    static defaults: DBDefaultsConfig;
    static options: {};
    config: DbConfigs;
    constructor(configs: DbOpts);
    initConfig(configs: DbOpts): void;
    /**
     * fetch
     * 兼容urls race | all发送
     */
    execute(): any;
    release(): void;
    /**
     * @static
     * @param {DbOpts} 传入参数
     * 将参数转化适配至DbConfigs
     * 扩展优先级:
     * 1. custom options
     * 2. extension options
     * 3. global defaults
     */
    static configTransform(configs: DbOpts): DbConfigs;
    static all(...requests: DbOpts[]): any;
    static race(requests: DbOpts[]): Promise<void>;
    static extendConfigs(exts: object): void;
    /**
     *
     * @param stage 执行阶段
     * @param name 注册拦截器名
     * @param handle 拦截器执行方法
     * @param fail err拦截器
     */
    static addExtension(stage: 'before' | 'after', name: string, handle: Function, fail?: Function): void;
    static closePlugin(name: string, enableKey?: string): void;
    static startPlugin(name: string, enableKey?: string): void;
    static global(globalConfigs: any): void;
}
declare class Sender implements ISender {
    autoRelease: boolean;
    config: SenderOpts;
    data: any;
    err: any;
    responseText: string;
    responseStatus: string;
    constructor(config: SenderOpts);
    initConfig(config: SenderOpts): void;
    persist(): void;
    send(): Promise<any>;
    before(config: SenderOpts): SenderOpts;
    after(data: unknown): void;
    succeed(): void;
    error(err: any): void;
    /**
     * 职责:
     * 1. 调用内部ajax库
     * 2. 执行用户提供的transformData,这是用户最先接触到返回数据的地方
     * 3. 根据策略缓存数据
     * 4. 注入race所需要的key
     */
    fetch(opts: CustomMustType): Promise<void>;
    release(): void;
}
export declare function getSender(opts: SenderOpts): Sender;
export declare function getDB(opts: DbOpts): DB;
export declare namespace DB {
    interface IAfterUse {
        (handler: any, name: any, err?: Function): any;
    }
    interface IBeforeUse {
        (handler: any, name: any): any;
    }
    interface IStageInterceptor<T> {
        use: T;
    }
    interface IInterceptors {
        after: IStageInterceptor<IAfterUse>;
        before: IStageInterceptor<IBeforeUse>;
    }
    export let interceptors: IInterceptors;
    export {};
}
export {};
