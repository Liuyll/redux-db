## redux-db
全方位拥抱`Typescript`,完全重构了@tencent/db库,并提供了重量级别的新功能.

### 功能:
#### 拦截器:
+ 可拔插的全局拦截器及单次请求拦截器
+ 可在请求中精确静止某个拦截器,而不用`axios.create`重新创建请求实例
+ 易用的插件机制,可配置多种hooks
+ 支持链式修改`config`,链式返回`data`

#### 性能:
`redux-db`池化了需要重复创建的请求实例类`DB`和请求发送类`Sender`,并且在钩子里面精确掌控了释放的时机,对用户完全透明.

当然,减少`gc`的副作用是丢失了对异步钩子的支持.不过,如果必要的话,你可以调用`persist`来阻止自动入池,并且手动`release`达到可控复用.

#### 强大的功能:
+ cancelToken:

    它不基于[Cancelable Promises](https://github.com/tc39/proposal-cancelable-promises)提案,所以你可以随意的使用它而不考虑兼容性.具体的使用方案你可以查看`axios`,`redux-db`完全兼容`axios cancelToken`接口.

+ fetch:
    
    是的,`redux-db`现在默认采用`fetch api`来获取数据.当然,在`fetch`不被支持的环境下,它还是会回退到`ajax`.

+ 缓存:
    
    `redux-db`提供了强大的缓存能力,它的策略来自于`PWA workbox`:
    + cache-first
    + cache-only
    + network-first
    + network-only
    + stale-while-revalidated
    
    不过,这些能力需要配套的中间件提供支持(已经附赠),`redux-db`本身并不提供.

+ preload
    
    有了`redux-db`,顺带实现`preload`是非常简单的事情.值得一提的是,`preload`会优先利用`link`原生缓存图片类数据.

### API
它基本兼容`@tencent/db`的使用
```
type someProperty = {
    url:string,
    successStatusRange ?:[] | number,
    complete ?: () => void,
    fail ?: () => void,
    data ?:object,
    type ?:RequestType,
    query ?: object,
    'Content-Type' ?: string,
    'with-credentials' ?: boolean,
    headers ?:HeadersType,
    cache ?: CacheType,
    timeout ?: number,
    // 是否开启请求耗时计算
    perf ?: boolean,
    transformData ?: Function,
    cancelToken ?: (acceptCancel:unknown) => void,
    updateCache ?: IUpdateCache,
    // 本次请求关闭插件
    bannerPlugins ?: string[],
    before:Before[],
    after:After[],
    ...
}
```
