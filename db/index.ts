import { getDB,DbOpts,DB } from './core'
import dbExts from './extension'

export function useDB(autoFetch:boolean,opts:DbOpts):Promise<unknown>;
export function useDB(opts:DbOpts):DB;

export function useDB(...options):Promise<unknown> | DB {
    let db
    const autoFetch = options[0]
    if(typeof autoFetch === 'boolean') {
        db = getDB(options[1])
        return db.execute()
    } else {
        db = getDB(autoFetch)
        return db
    }
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

export { DB }

function initWork() {
    initDbExts()
}

initWork()

