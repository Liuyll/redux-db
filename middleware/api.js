import { CALL_API } from '.'
import { useDB } from '../db'
import _ from '../utils'

export default ({ dispatch }) => next => action => {
    const opts = action[CALL_API]
    if(!opts) return next(action)

    const {
        useLocal
    } = opts

    const [STATUS_REQUEST,STATUS_SUCCESS,STATUS_FAIL] = opts.types

    let shouldUpdateCache,
        retry

    if(useLocal) {
        const {
            cacheStrategy = 'default',
            key
        } = useLocal

        const cache = _.safeJsonParse(window.localStorage.getItem(key))
        switch(cacheStrategy) {
        case 'cache-only': {
            return next(
                actionWith({
                    type: STATUS_SUCCESS,
                    data: cache,
                    warning: '此数据来自缓存,请检查缓存策略和数据正确性'
                })
            )
        }

        case 'network-only': {
            // 请求数据失败,但策略禁止缓存,返回错误
            // 该action只能由err回调发出
            retry = true
            if(action.__retry) {
                return next(actionWith({
                    reason: '请求数据失败,策略禁止调用缓存,请更改缓存策略或检查网络'
                }))
            }
            break
        }

        case 'network-first': {
            if(action.__retry) {
                return next(actionWith({
                    type: STATUS_SUCCESS,
                    data: cache,
                    warning: '请求数据失败,返回缓存数据,localStorage数据尚未更新,请验证数据正确性'
                }))
            }

            // update cache if success
            opts.updateCache = {
                key
            }
                
            break
        }

        default: {}
        case 'stale-while-revalidate': {}
        case 'cache-first': {
            shouldUpdateCache = true
            if(cache) {
                next(actionWith({
                    type: STATUS_SUCCESS,
                    data: cache,
                }))
            }
            opts.updateCache = {
                key
            }
        }
        }
    }

    // info action
    next(actionWith({
        type: STATUS_REQUEST
    })) 

    opts.succ = data => {
        if(shouldUpdateCache) {
            // 仅更新缓存,不触发reducer
            return 
        }

        // success action
        next(actionWith({
            data,
            type: STATUS_SUCCESS
        }),false,true)

    }

    opts.err = err => {
        // 缓存机制下,重新进入该中间件缓存处理步骤
        if(retry) dispatch(
            actionWith({
                type: STATUS_FAIL,
                err
            },true)
        )

        else next(actionWith({
            err,
            type: STATUS_FAIL
        }))
    }

    function actionWith(extAction,reDispatch = false,skipCurrentMiddleware = false) {
        const extActionStatus = {
            STATUS: 'fetching'
        }
        const _action = {
            ...action,
            ...extAction,
            ...reDispatch ? { __retry: true } : {}
        }
        
        switch(_action.type) {
        case STATUS_SUCCESS:
            extActionStatus['STATUS'] = 'success'
            break
        case STATUS_FAIL:
            extActionStatus['STATUS'] = 'fail'
            break
        default:
            break
        }

        Object.assign(_action,extActionStatus)
        
        if(skipCurrentMiddleware) delete _action[CALL_API]
        return _action
    }

    return useDB(true,opts)
}

