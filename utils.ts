interface IUtils {
    extend(target:unknown,ext:object)
    safeJsonParse(target:string):object
    safeJsonStringify(target:object): string
    isSupportPreload():boolean
}

function extend(target:unknown,exts:object) {
    for(let ext in exts) {
        target[ext] = exts[ext]
    }
}


function safeJsonParse(target:string):object{
    let ret:object
    try {
        ret = JSON.parse(target)
    } catch(e) {
        ret = {
            transform: 'fail',
            raw: target
        }
    }
    return ret
}

function safeJsonStringify(target:object):string {
    let ret:object | string
    try {
        ret = JSON.stringify(target)
    } catch(e) {
        ret = 'transform fail'
    }
    return ret
}

function isSupportPreload() {
    return (
        document.createElement('link').relList &&
        document.createElement('link').relList.supports('preload')
    )
}

const _:IUtils = {
    extend,
    safeJsonParse,
    isSupportPreload,
    safeJsonStringify
}


export default _

