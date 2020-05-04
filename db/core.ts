import { CustomMustType,CustomOptionalType } from './interface'
import { ajax } from './fetch'
import _ from '../utils'

interface IDB extends IPool<DB>{
    execute:(args:unknown[]) => void
}

interface ISenderHooks {
    before(config:SenderOpts):SenderOpts
    after(data:unknown):any
}

interface ISender extends ISenderHooks,IPool<Sender>{
    send()
    succeed()
    error(e:any)
    fetch(opts:CustomMustType)
}

interface IPool<T> {
    release()
    initConfig(config:T extends DB ? DbOpts : SenderOpts)
}

type Before = (config:SenderOpts) => SenderOpts
type After = (data:unknown) => any
export type DbOpts = {
    url:string,
    succ:Function,
    err:Function,
    before?:Before[],
    after?:After[]
} & CustomOptionalType


export type SenderOpts = {
    before ?: Before[]
    after ?: After[]
} & DbConfigs

type DbConfigs = Omit<DbOpts,'succ' | 'err'> & {
    succ:Function[]
    err:Function[]
}

const DBPools:DB[] = []
const SenderPools:Sender[] = []

const DB_CONTAIN_COUNT = 10
const SENDER_CONTAIN_COUNT = 10

// static desc
interface IDBS {
    extendConfig(exts:object)
    options: object
} 

function extendConfigs<T>(configs:T,...exts:object[]):T {
    for(let ext of exts) {
        for (let _ext in ext) {
            let _v = ext[_ext]
            if(!~['err','succ','before','after'].indexOf(_ext)) configs[_ext] = _v
            else {
                _v = _v.pop ? _v : [_v]
                configs[_ext] && configs[_ext].pop ? (configs[_ext] = [].concat.call(configs[_ext],_v)) : (configs[_ext] = _v) 
            }
        }
    }

    return configs
}

export class DB implements IDB{
    static options = {}
    config:DbConfigs 

    constructor(configs:DbOpts) {
        this.config = DB.configTransform(configs)
    }

    initConfig(configs:DbOpts) {
        this.config = DB.configTransform(configs)
    }
    
    execute() {
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
     * 主要是succ和err将由middleware的单个变成数组形式,以供内部扩展调用
     * 增加before,供插件机制调用
     */
    static configTransform(configs:DbOpts):DbConfigs {
        return extendConfigs<DbConfigs>({
            succ: [],
            err: [],
            before: [],
            type: configs.type ? configs.type : 'GET'
        } as any as DbConfigs,configs,DB.options)
    }

    static all(...requests:DbOpts[]) {
        let succ = []
        let err = []
        const noop = () => {}

        requests.forEach(r => {
            succ.push(r.succ)
            err.push(r.err)
            r.succ = noop
        })

        return Promise.all(requests.map(r => getDB(r).execute())).then(datas => {
            succ.forEach((cb,i) => cb && cb(datas[i]))
            return datas
        }).catch((e:Error) => {
            err.forEach(erc => erc && erc(e))
        })
    }

    static race(...requests:DbOpts[]) {
        const succ = []
        const err = []
        const raceMap = new Map()
        const noop = () => {}

        requests.forEach((r,i) => {
            succ.push(r.succ)
            err.push(r.err)
            r.succ = noop

            const raceFlag = Symbol()
            r['__race_key_'] = raceFlag
            raceMap.set(raceFlag,i)
        })

        function executeRaceCb(ret:any,type:'succ' | 'err') {
            const { __race_key_ } = ret
            const index = raceMap.get(__race_key_)

            ;(0,eval)(`${type}[${index}] && ${type}[${index}](ret)`)
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

    static addExtension(stage:'before' | 'succ' | 'err' | 'after',name:string,handle:Function) {
        let conf = {},
            enableKey = handle['enableKey'] || name + 'Enable'

        _.extend(conf, handle['option'] || {})
        conf[stage] = (...args:any[]) => {
            if (this.options[enableKey]) {
                if(args[0].bannerPlugins && args[0].bannerPlugins.includes(name)) return args[0]
                return handle.apply(this, args)
            }
        }
        
        DB.extendConfigs(conf)
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

    send() {
        this.config = this.before(this.config)
        return this.fetch(<CustomMustType>this.config).then(_ => {
            if(this.err) throw new Error()

            // 拦截器调用的时机在回调之前,否则无法修改数据
            this.after(this.data)
            this.succeed()
            // 注意放入池子的时机,如果需要可以调用persist保持
            this.release()
            return this.data
        }).catch(__ => {
            this.error(this.err)
            return this.err
        })
    }

    before(config:SenderOpts):SenderOpts {
        return config.before ? config.before.reduce((_config,cb) => { return cb(_config) },config) : config
    }

    // transform data before processSucc callback
    after(data:unknown) {
        this.data = this.config.after ? this.config.after.reduce((_data,cb) => cb(_data),data) : data
    }

    succeed() {
        const convertType = 'CONVERT_TO_FALSE'
        try {
            let ret = null
            
            let data = this.data
            delete data.__race_key_

            this.config.succ.forEach(cb => {
                ret = cb(data)
                if(ret.pop && ret[0] === false) throw new Error(JSON.stringify({
                    type: convertType,
                    msg: ret[1]
                }))
            }) 
        } catch({ message }) {
            try {
                let ret = JSON.parse(message)
                if(ret.type === convertType) this.config.err.forEach(cb => cb(ret.msg))
            } catch(e) {
                new Error(e.message)
            }
        }
    }

    error(err){
        this.config.err && this.config.err.pop && this.config.err.forEach(cb => cb(err))
    }

    fetch(opts:CustomMustType):Promise<unknown> {
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
       
        return ajax({ ...opts,...extendOpt }).then(r => {
            let data = _.safeJsonParse(r as any)
            // 在注入race key之前缓存
            let key 
            if((key = this.config.updateCache && this.config.updateCache.key)) {
                window.localStorage.setItem(key,_.safeJsonStringify(data))
            }

            injectRaceKey(data)
            this.data = data
        }).catch((_err:object | string) => {
            let err 
            if(typeof _err !== 'object') {
                err = {
                    msg: _err,
                    ... _err === '__FETCH_CANCEL' ? { reason: 'request is canceled' } : {}
                }
            }
            
            else err = _err
            injectRaceKey(err)
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

