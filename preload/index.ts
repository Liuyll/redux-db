import { DbOpts } from '../db/core'

import { useDB } from '../db'
import _ from '../utils'

type CacheKey = string | symbol | number

type urlType = {
    url: string
}

type urlsType = {
    urls: string[]
}

type uousType<
    T,
    I = (urlType | urlsType),
    E = (urlType & urlsType),
    O = T extends I ? T : never,
    K = T extends E ? T & O : T,
> = K

type _PreloadOpts = Omit<DbOpts,'url'> & {
    cacheKey ?: CacheKey
    sourceType ?: any
} 

declare var window:Window & {Preload:IPreload}

type PreloadOpts<T> = _PreloadOpts & uousType<T>

export interface IPreload {
    dataMap: Map<CacheKey,any>
    load<T extends _PreloadOpts>(opts:PreloadOpts<T>,complete:Function)
    get(cacheKey:CacheKey,forceFresh:boolean):any
}

(function InjectPreloadInWindow(){
    
    const placeHolder = Symbol('placeHolder')
    class Preload implements IPreload{
        dataMap:Map<CacheKey,any> = new Map()

        load<T extends _PreloadOpts>(opts:PreloadOpts<T>,completeCb:Function) {
            const { cacheKey = (<_PreloadOpts & urlType>opts).url,succ: succCb,err: errCb,sourceType } = opts 
            if(sourceType === 'image') {
                if(_.isSupportPreload){
                    Preload.preloadImage((<_PreloadOpts & urlType>opts).url)
                }
            } else if(sourceType === 'images') {
                (<_PreloadOpts & urlsType>opts).urls.forEach(url => {
                    Preload.preloadImage(url)
                })
            }

            let data = this.dataMap.get(cacheKey)
            if(data) return data

            function succ(data:any) {
                completeCb(data)
                succCb && succCb(data)
                this.dataMap.set(cacheKey,data)
            }

            function err(err:any) {
                errCb && errCb(err)
                this.dataMap.set(cacheKey,null)
            }

            this.dataMap.set(cacheKey,placeHolder)

            _.extend(opts,{
                succ,
                err
            })

            useDB(true,(<_PreloadOpts & urlType>opts))
        }
        get(cacheKey: CacheKey,forceFresh:boolean):any {
            let data = this.dataMap.get(cacheKey)
            if(data === placeHolder) return 'data is fetching'

            if(data.fresh) {
                data.fresh = false
                return data
            }
            return forceFresh ? 'data is not fresh' : data
        }

        static preloadImage(href:string) {
            let link = document.createElement('link')
            link.href = href
            link.as = 'image'
            link.rel = 'preload'
            document.head.appendChild(link)

            let image = new Image()
            image.src = link.href
            image.onload = () => {
                document.head.removeChild(link)
            }
        }
    }

    window.Preload = new Preload()
})()

