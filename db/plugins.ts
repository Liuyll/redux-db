import { DB } from './core'
import _ from '../utils'

interface IDbExts {
    before:object
    after:object
}

const dbExts:IDbExts = {
    before: {},
    after: {}
}

function useInterceptor(stage:'after' | 'before',name,interceptor,fail ?: Function) {
    DB.addExtension(stage,name,interceptor,fail)
    DB.startPlugin(name)
}

const SenderInterceptors = {
    interceptors: {
        before: {
            use(interceptor,name ?: string) {
                useInterceptor('before',name,interceptor)
            }
        },
        after: {
            use(interceptor,name ?: string,fail ?: Function) {
                useInterceptor('after',name,interceptor,fail)
            }
        }
    }
}

_.extend(DB,{
    interceptors: SenderInterceptors.interceptors
})

export default dbExts