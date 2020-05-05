import { DB } from './core'
import _ from '../utils'

interface IDbExts {
    before:object
    succ:object
    err:object
    after:object
}

const dbExts:IDbExts = {
    before: {},
    succ: {},
    err: {},
    after: {}
}

// 拦截器只暴露request和response
// succ和err通过内部修改
const SenderInterceptors = {
    interceptors: {}
}

// 优先proxy代理
if(typeof Proxy !== undefined) {
    let proxyKeys = ['before','after']
    SenderInterceptors.interceptors = new Proxy({},{
        get(__,stage) {
            if(~proxyKeys.indexOf(stage as string)) {
                let handler = new Proxy({},{
                    get(__,key) {
                        if(key === 'use') {
                            return (interceptor,name) => {
                                DB.addExtension(stage as any,name,interceptor)
                                DB.startPlugin(name)
                            }
                        }
                    }
                })
                return handler
            }
            return {
                use: () => new Error(`拦截器${stage as string}不是${proxyKeys}的任何一个`)
            }
        }
    })
} else {
    
}

_.extend(DB,{
    interceptors: SenderInterceptors.interceptors
})

export default dbExts