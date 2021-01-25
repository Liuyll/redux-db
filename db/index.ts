import { getDB,DbOpts,DB } from './core'
import dbExts from './plugins'
import { DEV_PROXY_PORT, setDevProxyPort } from '../db/fetch'

const startCheckPort = 25918
function useDB(autoFetch:boolean,opts:DbOpts):Promise<any>;
function useDB(opts:DbOpts):DB;

function useDB(...options):Promise<any> | DB {
    let db:DB
    const autoFetch = options[0]
    if(autoFetch === true) {
        if(options[1].proxy && !DEV_PROXY_PORT) {
            return new Promise(resolve => {
                checkProxyServerStart(() => {
                    db = getDB(options[1])
                    resolve(db.execute())
                })
            })
        } 
        db = getDB(options[1])
        return db.execute()
    } else {
        if(options[1].proxy && !DEV_PROXY_PORT) {
            return new Promise(resolve => {
                checkProxyServerStart(() => {
                    db = getDB(autoFetch)
                    resolve(db)
                })
            })
        }
        db = getDB(autoFetch)
        return db
    }
}

function useFetch(url: string): Promise<any>
function useFetch(options: DbOpts): Promise<any>
function useFetch(options:DbOpts | string):Promise<any> {
    if(typeof options === 'string') options = {
        url: options
    }
    return useDB(true, options)
}

function initDbExts() {
    for(let stage in dbExts) {
        let handles = dbExts[stage]
        for(let name in handles) {
            DB.addExtension(stage as any,name,handles[name])
            DB.startPlugin(name)
        }
    }
}

function checkProxyServerStart(cb:Function) {
    checkPort(startCheckPort, cb)
}

function checkPort(port, cb) {
    useFetch({
        url: `localhost:${port}/check`,
        timeout: 500,
    }).then(() => {
        setDevProxyPort(port)
        cb()
    }, () => {
        checkPort(port + 1, cb)
    })
}

function initWork() {
    initDbExts()
}

initWork()

export { 
    DB, 
    useDB,
    useFetch
}
