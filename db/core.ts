import { CustomMustType,CustomOptionalType } from './interface'
import { ajax } from './fetch'
import _ from '../utils'

export const CONVERT_TO_FALSE = 'CONVERT_TO_FALSE'
interface IDB extends IPool<DB>{
    execute:(args:unknown[]) => any
}

interface ISenderHooks {
    before(config:SenderOpts):SenderOpts
    after(data:unknown):any
}

interface ISender extends ISenderHooks,IPool<Sender>,ControlledPool{
    send()
    succeed()
    error(e:any)
    fetch(opts:CustomMustType)
}

interface ControlledPool {
    autoRelease: boolean
    persist():void
}

interface IPool<T> {
    release()
    initConfig(config:T extends DB ? DbOpts : SenderOpts)
}

type Before = (config:SenderOpts) => SenderOpts
type After = (data:unknown) => any

/**
 * succ和err接口将不被redux-db支持
 * DB类将作为抽象层兼容@tencent/db
 */
export type DbOpts = {
    // 标识race
    name ?: string,
    url ?: string,
    urls ?: string[],
    isCdnSelect ?: boolean,
    // TODO: 支持在action里直接调用DB.race
    succ ?: Function,
    err ?: Function,
    before ?: Before[],
    after ?: After[],
    rawUrl ?: boolean
} & CustomOptionalType


export type SenderOpts = {
    before ?: Before[]
    after ?: After[]
} & DbConfigs

type DbConfigs = Omit<DbOpts,'err'> & {
    err: Function[]
}

const DBPools:DB[] = []
const SenderPools:Sender[] = []

const DB_CONTAIN_COUNT = 10
const SENDER_CONTAIN_COUNT = 10

interface DBDefaultsConfig {
    baseUrl ?: string,
    withCredentials ?: boolean,
    withBrowserCache ?: boolean,
}

function extendConfigs<T>(configs:T,...exts:object[]):T {
    for(let ext of exts) {
        for (let _ext in ext) {
            let _v = ext[_ext]
            if(!~['before','after','err'].indexOf(_ext)) configs[_ext] = _v
            else {
                _v = _v.pop ? _v : [_v]
                configs[_ext] && configs[_ext].pop ? (configs[_ext] = [].concat.call(configs[_ext],_v)) : (configs[_ext] = _v) 
            }
        }
    }

    // 添加baseUrl
    if(configs['baseUrl'] !== '' && configs['url']) {
        let url = configs['url']

        let isHttp = url.indexOf('http://')
        let isHttps = url.indexOf('https://')

        if(!~isHttp) {
            let length = 'http://'.length
            configs['url'] = configs['url'].substring(0,isHttp + length + 1) + configs['url'].substring(isHttp + length)
        } else if(!~isHttps) {
            let length = 'https://'.length
            configs['url'] = configs['url'].substring(0,isHttps + length + 1) + configs['url'].substring(isHttps + length)
        }
    }

    return configs
}

export class DB implements IDB{
    static defaults:DBDefaultsConfig = {
        baseUrl: ''
    }

    static options = {}

    config:DbConfigs 

    constructor(configs:DbOpts) {
        this.config = DB.configTransform(configs)
    }

    initConfig(configs:DbOpts) {
        this.config = DB.configTransform(configs)
    }
    
    /**
     * fetch
     * 兼容urls race | all发送
     */
    execute() {
        if(_.isArray(this.config)) {
            return DB.all(this.config as any)
        }
        // cdns
        if(this.config.urls) {
            let name = this.config.name
            if(this.config.isCdnSelect && name) {
                let url
                if((url = window.sessionStorage.getItem(`__cdn_${name}`))) {
                    delete this.config['urls']
                    this.config.url = url
                    return getSender(this.config).send()
                }
            }

            let urls = this.config.urls
            delete this.config['urls']
            const fetchMap = urls.map(url => {
                this.config.url = url
                return {
                    ...this.config
                }
            })

            return DB.race(fetchMap as any)
        }
        
        // ajax
        return getSender(this.config).send()
    }

    release() {
        if(DBPools.length >= DB_CONTAIN_COUNT) {}
        else {
            this.config = null
            DBPools.push(this)
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
    static configTransform(configs:DbOpts):DbConfigs {
        return extendConfigs<DbConfigs>({
            before: [],
            after: [],
            err: [],
            type: configs.type ? configs.type : 'GET'
        } as any as DbConfigs,this.defaults,this.options,configs)
    }

    static all(...requests:DbOpts[]) {
        let succ = []
        let err = []
        const noop = () => {}

        requests.forEach(r => {
            succ.push([r.succ])
            err.push([r.err])

            r.succ = noop
            r.err = noop
        })

        return Promise.all(requests.map(r => getDB(r).execute())).then(datas => {
            succ.forEach((cb,i) => cb && cb(datas[i]))
            return datas
        }).catch((e:Error) => {
            err.forEach(erc => erc && erc(e))
        })
    }

    static race(requests:DbOpts[]) {
        const succ = []
        const err = []
        const raceMap = new Map()
        const noop = () => {}

        requests.forEach((r,i) => {
            // TODO: 执行回调的错误捕获,不能让一个回调错误影响到后面的执行
            succ.push([r.succ])
            err.push([r.err])

            // if cdnselect -> cache url
            succ.forEach(s => s.unshift((__:any,url:string) => {
                let name = r.name
                r.isCdnSelect && name && window.sessionStorage.setItem(`__cdn_${name}`,url)
            }))

            r.succ = noop
            r.err = noop

            const raceFlag = Symbol()
            r['__race_key_'] = raceFlag
            raceMap.set(raceFlag,i)
        })

        function executeRaceCb(ret:any,type:'succ' | 'err') {
            const { __race_key_ } = ret
            const index = raceMap.get(__race_key_)

            // eslint-disable-next-line
            if(!index) return console.warn('after拦截器删除了内部RACE标识,请不要操作返回数据之外的键')
            type === 'succ' ? succ[index].forEach(cb => cb(ret,requests[index].url)) : err[index].forEach(cb => cb(ret))
        }

        return Promise.race(requests.map(r => getDB(r).execute())).then(data => {
            executeRaceCb(data,'succ')
        }).catch((e:Error) => {
            executeRaceCb(e,'err')
        })
    }

    static extendConfigs(exts:object) {
        extendConfigs(this.options,exts)
    }

    /**
     * 
     * @param stage 执行阶段
     * @param name 注册拦截器名
     * @param handle 拦截器执行方法
     * @param fail err拦截器
     */
    static addExtension(stage:'before' | 'after',name:string,handle:Function,fail?:Function) {
        let conf = {},
            enableKey = handle['enableKey'] || name + 'Enable'

        _.extend(conf, handle['option'] || {})

        if(stage === 'before') {
            conf[stage] = function (this:Sender,...args:any[]) {
                if (DB.options[enableKey]) {
                    if(args[0].bannerPlugins && args[0].bannerPlugins!.includes(name)) return args[0]
                    return handle.apply(this, args)
                }
            }
        }

        if(stage === 'after') {
            conf[stage] = function (this:Sender,data:any){
                let config = this.config

                if (DB.options[enableKey]) {
                    if(config.bannerPlugins && config.bannerPlugins!.includes(name)) return data
                    return handle.call(this, data)
                }
            }
        }
       
        if(stage === 'after' && fail) {
            conf['err'] = function (this:Sender,err) {
                let config = this.config
                if (DB.options[enableKey]) {
                    if(config.bannerPlugins && config.bannerPlugins!.includes(name)) return 
                    return fail.call(this, err)
                }
            }
        }
        
        this.extendConfigs(conf)
    }

    static closePlugin(name:string,enableKey = 'Enable') {
        const t = name + enableKey
        this.options[t] = false
    }

    static startPlugin(name:string,enableKey = 'Enable') {
        const t = name + enableKey
        this.options[t] = true
    }
}

class Sender implements ISender {
    autoRelease = false
    config:SenderOpts = null
    data = null
    err = null
    responseText = ''
    responseStatus = ''

    constructor(config:SenderOpts) {
        this.config = config
    }

    initConfig(config:SenderOpts) {
        this.config = config
    }

    persist() {
        this.autoRelease = false
    }

    send() {
        this.config = this.before(this.config)
        return this.fetch(<CustomMustType>this.config).then(_ => {
            if(this.err) throw this.err
            // 拦截器调用的时机在回调之前,否则无法修改数据
            this.after(this.data)
            this.succeed()
            // 注意放入池子的时机,如果需要可以调用persist保持
            this.autoRelease && this.release()

            // 取出数据
            return this.data.__raw == undefined ? this.data : this.data.__raw
        }).catch(err => {
            this.error(err)
            throw new FetchError(err.message, this.send) // eslint-disable-line
        })
    }

    before(config:SenderOpts):SenderOpts {
        return config.before ? config.before.reduce((_config,cb) => { 
            try {
                return cb(_config) 
            } catch(e) {
                console.error(`
                    before拦截器发生错误,error:${e}
                `)
                throw e
            }
            
        },config) : config
    }

    // transform data before processSucc callback
    after(data:unknown) {
        this.data = this.config.after.length ? this.config.after.reduce((_data,cb) => {
            if(_.isArray(_data) && _data[0] === CONVERT_TO_FALSE) throw new Error(JSON.stringify({
                type: CONVERT_TO_FALSE,
                reason: _data[1]
            }))

            return cb.call(this,_data)
        },data) : data
    }

    succeed() {
        try {            
            let data = {
                ...this.data
            }
            delete data.__race_key_
            this.data = data
            this.config.succ(data) 
        } catch({ message }) {
            try {
                let ret = _.safeJsonParse(message)
                if(ret['type'] === CONVERT_TO_FALSE) this.error(ret)
            } catch(e) {
                new Error(e.message)
            }
        }
    }

    error(err){
        this.config.err && this.config.err.forEach(cb => {
            cb.call(this,err)
        })
    }

    /**
     * 职责:
     * 1. 调用内部ajax库
     * 2. 执行用户提供的transformData,这是用户最先接触到返回数据的地方
     * 3. 根据策略缓存数据
     * 4. 注入race所需要的key
     */
    fetch(opts:CustomMustType):Promise<void> {
        const extendOpt = {
            complete() {}
        }

        /**
        * 注入race_key
        * 否则race执行时无法知道成功的位置
        */
        const injectRaceKey = data => {
            _.extend(data,{
                __race_key_: this.config['__race_key_']
            })
        }
       
        return ajax({ ...opts, ...extendOpt }).then(r => {
            let { transformData } = this.config
            let data:string | object = _.safeJsonParse(r as any)

            // 对本身就是string类型的返回值不进入任何处理
            // if(data['__transform'] === 'fail') data = data['__raw'] 

            if(transformData && typeof transformData === 'function') {
                r = transformData(r)
            } else new Error('transformData isn\'t a function')

            // 在注入race key之前缓存
            let key 
            if((key = this.config.updateCache && this.config.updateCache.key)) {
                window.localStorage.setItem(key, typeof data === 'object' ? _.safeJsonStringify(data) : data)
            }

            this.data = data
            injectRaceKey(data)
        }).catch((_err:object | string) => {
            let err 
            if(typeof _err !== 'object') {
                err = {
                    msg: _err,
                    ... _err === '__FETCH_CANCEL' ? { reason: 'request is canceled' } : {}
                }
            }
            
            else err = _err
            // injectRaceKey(err)
            this.err = err
        })
    }

    release() {
        if(SenderPools.length >= SENDER_CONTAIN_COUNT) {}
        else {
            this.config = null
            this.data = null
            this.responseText = null
            this.responseStatus = null

            SenderPools.push(this)
        }
    }
}   

export function getSender(opts:SenderOpts) {
    if(SenderPools.length) {
        let sender = SenderPools.pop()
        sender.initConfig(opts)
        return sender
    }
    else {
        const useSender = new Sender(opts)
        return useSender
    }
}

export function getDB(opts:DbOpts):DB {
    autoAddSchemaPrefix(opts)
    if(DBPools.length) {
        let db = DBPools.pop()
        db.initConfig(opts)
        return db
    }
    else {
        const useDb = new DB(opts)
        return useDb
    }
}

// 自动添加http前缀
function autoAddSchemaPrefix(opts: DbOpts) {
    if(opts.rawUrl) return 

    const checkAndHandleUrl = (url: string) => /.*\/\//.test(url) ? url : 'http://' + url
    if(opts.url) {
        opts.url = checkAndHandleUrl(opts.url)
    } else if(opts.urls) {
        opts.urls.forEach((url,i,urls) => {
            urls[i] = checkAndHandleUrl(url)
        })
    }
}

export namespace DB {
    interface IAfterUse {
        (handler,name,err ?: Function):any
    }
    interface IBeforeUse {
        (handler,name):any
    }

    interface IStageInterceptor<T> {
        use:T
    }
    interface IInterceptors {
        after:IStageInterceptor<IAfterUse>
        before:IStageInterceptor<IBeforeUse>
    }

    export let interceptors:IInterceptors
}

class FetchError extends Error {
    constructor(msg, callee ?: Function) {
        super(msg)
        this.name = this.constructor.name
        Error.captureStackTrace && Error.captureStackTrace(this, callee ? callee : this.constructor)
    }
}