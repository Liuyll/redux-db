## rexos
全方位拥抱`Typescript`,完全重构了@tencent/db库,并提供了重量级别的新功能.

### install
npm
```
npm install -S rexos
```

## 从其他框架迁移
#### @tencent/db
+ redux/db 默认不发送cookie,你需要主动设置`with-credentials`

    如果从`@tencent/db`迁移,应该初始化DB
    ```
    DB.defaults['with-credentials'] = true
    ```

+ api middleware
`rexos`已经提供了兼容`api middleware action`的中间件.

    不过在`rexos`里,`call api`必须引用自`rexos/middleware/api`,因为它是一个`Symbol`,而非一个字符串.

+ extension

    `rexos`本身没有实现任何扩展.`@tencent/db`原有的扩展应该使用`rexos`提供的插件机制进行添加.

+ err/succ回调

    `rexos`本身已经实现了`before`和`after`回调,保留的`err`和`succ`仅为了支持老式的中间件,如果错误处理需求,应该配置全局`after`拦截器,并在其中进行错误判断.

#### axios
`rexos`的接口几乎与`axios`一致，参照文档开发即可。
### 功能:
#### 拦截器:
+ 可拔插的全局拦截器及单次请求拦截器
+ 可在请求中精确静止某个拦截器,而不用`axios.create`重新创建请求实例
+ 易用的插件机制,可配置多种hooks
+ 支持链式修改`config`,链式返回`data`

#### 代理
`rexos`内置了跨域代理功能，因为`node`的一些`api`无法运行于浏览器上，所以需要配合`webpackPlugin`或者主动开启`server`。

+ 主动开启：
    ```
    const startServer = require('rexos/lib/proxy').startServer
    startServer()
    ```

+ 使用`WebpackPlugin`开启：
    ```
    const plugin = require('rexos/lib/proxy').rexosProxyPlugin
    plugins.push(new plugin())
    ```
#### 性能:
`rexos`池化了需要重复创建的请求实例类`DB`和请求发送类`Sender`,并且在钩子里面精确掌控了释放的时机,对用户完全透明.

当然,减少`gc`的副作用是丢失了对异步钩子的支持.不过,如果必要的话,你可以调用`persist`来阻止自动入池,并且手动`release`达到可控复用.

#### 强大的功能:
+ cancelToken:

    它不基于[Cancelable Promises](https://github.com/tc39/proposal-cancelable-promises)提案,所以你可以随意的使用它而不考虑兼容性.具体的使用方案你可以查看`axios`,`rexos`完全兼容`axios cancelToken`接口.

+ fetch:
    
    是的,`rexos`现在默认采用`fetch api`来获取数据.当然,在`fetch`不被支持的环境下,它还是会回退到`ajax`.

+ 缓存:
    
    `rexos`提供了强大的缓存能力,它的策略来自于`PWA workbox`:
    + cache-first
    + cache-only
    + network-first
    + network-only
    + stale-while-revalidated
    
    不过,这些能力需要配套的中间件提供支持(已经附赠),`rexos`本身并不提供.

+ preload
    
    有了`rexos`,顺带实现`preload`是非常简单的事情.值得一提的是,`preload`会优先利用`link`原生缓存图片类数据.

### API

#### useFetch
`useFetch(string | DbOptions)`
```
import { useFetch } from 'rexos'
useFetch('www.baidu.com').then(data => {
    console.log(data)
})
```
默认情况下，`useFetch`接收一个`DbOptions`对象
```
// DbOptions
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
    rawUrl ?: boolean,
    json ?: boolean
}
```
当然，如果你只需要使用简单的`Get`请求，那么也可以使用
```
useFetch('www.baidu.com')
// ==
useFetch({
    url: 'www.baidu.com',
    method: 'GET'
})
```

#### 基础使用
与`@tencent/db`一致,`rexos`提供了取数中间件,你可以以一个模块的形式维护数据
```
getDataAction() {
    return {
        [CALL_API]: {
            url: 'ke.qq.com/data/some...'
        }
    }
}
```
#### Content-Type
默认的，如果你为`data`传入一个对象，且`type`不为`GET`,则`rexos`将以`application/json`的形式发送请求。

如果你需要以`application/x-www-form-urlencoded`的形式传入，指定参数`form: true`
#### transformData
`rexos`提供了数据转换的功能,你可以通过它修改返回的数据

不过,如果你需要以一定的规范修改返回的数据,或者进行复杂的转换,建议使用`interceptor`
```
getDataAction() {
    return {
        [CALL_API]: {
            url: 'ke.qq.com/data/some...',
            transformData(data) {
                return {
                    ...data,
                    ...extra
                }
            }
        }
    }
}
```

#### interceptor
作用范围:
+ global interceptor
    
    每次请求都会执行的全局拦截器,一处配置,处处生效

+ action interceptor

    仅在单次请求里生效

类型:
+ before(request):
    
    `before(config => config,[name:any])`

    + 每个before拦截器都会在发送请求前调用,它接收一个配置,并返回一个配置. 
    ```
    // usage:
    before = (config) => {
        // do something
        return {
            ...config,
            extra:...
        }
    }
    ```
    需要注意的是,`before`拦截器并不进行`shallow merge`,你需要返回全部配置
+ after(response):

    `after(data => data,[name:any])`

    每个`after`拦截器都会在得到数据并检查结果后调用,它接收一个已经由可选配置`transformData`转换好的数据,并返回一个新的数据.
    
    需要注意的是,`after`拦截器并不是最早接触到返回数据的函数,在它之前至少会经过`checkStatus`这个阶段.如果返回的`status`不是可接受的,那么不会调用`after`拦截器.

你可以在拦截器里访问`Sender`操作类,但这要求你不要使用箭头函数
##### global
对于任何全局拦截器,都必须要提供一个`name`进行注册
```
DB.interceptors.before.use(config => config,'default')
```

##### action
相反,对于`action`级别的拦截器,不用进行任何注册,它只作用于当次请求
```
getDataAction() {
    return {
        [CALL_API]: {
            before:[config => config]
        }
    }
}
```

##### close globalInterceptor
在`axios`里,我们有一个很大的困惑就是,配置了全局拦截器后没办法在某次请求里消除.只有通过`axios.create`创建的全新的实例来清除拦截器.

问题是,我们可能只需要清除某一个拦截器,比如某次不用上报的请求,我们在发送前需要清理掉上报拦截器,但保留其余的拦截器,重新创建实例会新增很多不必要的工作.

在`rexos`里面,禁用掉某次请求的某个全局拦截器非常简单
```
getDataAction() {
    return {
        [CALL_API]: {
            bannerPlugins:['before-report','after-report']
        }
    }
}
```
这需要使用者命名的规范性,比如以`before-`开头

##### 内置的拦截器
`rexos`还有两个内置的拦截器:
+ succ
+ err

⚠️:这两个拦截器仅用来支持老式的中间件,请不要主动使用他们.
```
DB.addExtensions('succ',name,handler)
```

#### cancelToken
上面已经提到,`cancelToken`并不依赖于`Proposal Cancelable Promises`.它精确的控制了请求是否应该被关闭.
不过,自定义的`cancelToken`接口必须满足`(cancel) => acceptedCancel = cancel`这样的形式.

未来会考虑用工厂函数的形式构造,但都需要使用者适配接口的规范.
```
let cancel
let cancelToken = (_cancel) => cancel = _cancel

getDataAction({cancelToken}) {
    return {
        [CALL_API]: {
            cancelToken
        }
    }
}

setTimeout(() => cancel(),1000)
```
注意,即使关闭了某个请求,也会返回一个`type = fail`的`action`,但它不会对仓库造成任何影响.

#### 缓存
依赖于`localStorage`,`rexos`提供了一些缓存策略,具体的方案你可以查阅`Google PWA Workbox`.下面只列出几个常用的策略
+ cache-first(default)

    在这种情况下,`rexos`会优先寻找缓存,不论缓存是否存在,都会向目标请求数据,并在成功后更新缓存.

+ network-first

    在这种情况下,`rexos`会优先请求数据,但在首次失败后,`rexos`将不会再次请求,而是返回缓存.

+ network-only

    在这种情况下,`rexos`会优先请求数据,但在首次失败后,`api middleware`会直接返回一个`type:fail`的`action`
```
getDataAction() {
    return {
        [CALL_API]: {
            useLocal: {
                key: ...,
                strategy: 'cache-first'
            }
        }
    }
}
```

#### 配置
`rexos`提供全局配置扩展,一处修改,处处生效.

```
DB.defaults.baseUrl = ''
...
```

#### 请求头
##### ContentType
+ general:

    为兼容`@tencent/db`,`POST`默认的`Content-Type`是`x-www-form-urlencoded`,不过你可以手动指定为`application/json`

    默认情况下,你不需要手动转换`data`,只需要指明`Content-Type`即可
    ```
    getDataAction() {
        return {
            [CALL_API]: {
                type:'POST',
                headers: {
                    data: {
                        name:'lyl',
                        age:20
                    }
                }
            }
        }
    }
    ```

    手动指定为`json`
    ```
    getDataAction() {
        return {
            [CALL_API]: {
                headers: {
                    'Content-Type': 'application/json',
                    data: {
                        name:'lyl,
                        age:20
                    }
                }
            }
        }
    }
    ```

+ form-data:

    如果需要上传`form-data`形式的数据,你依然需要设置`multipart:form-data`.不过不要担心,`rexos`并不会上传这个`header`,它只是作为内部的一个标识而已.

    甚至,你可以直接以一个构建好的`FormData`作为`data`,这样就不需要指定`header`了.
    ```
    getDataAction() {
        return {
            [CALL_API]: {
                type:'POST',
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            }
        }
    }
    ```


#### cdn select
你可以提供多个cdn,`rexos`会选择最快的一个返回,并在后面的请求中自动切换到该cdn(这个过程用户不会感知)

使用该功能,你需要在`action`里:
+ 注册该cdn组的`name`
+ 配置`isCdnSelect`参数为`true`
+ 修改`url`为`urls`
```
getDataAction() {
    return {
        [CALL_API]: {
            name: 'dataget'
            isCdnSelect: true,
            urls: ['dataget/cdn1','dataget/cdn2','dataget/cdn3']
        }
    }
}
```
需要注意的是,`rexos`只会在`session`生命周期内保存最快cdn.

### 可能会遇到的问题

上面已经提到过,`rexos`自动池化了某些关键类,这导致了一些`response`拦截器里无法异步访问数据
```
DB.interceptors.after.use(function(){
    setTimeout(_ => {
        console.log(this.data) // undefined or dirty data
    },0)
},'async')
```
这是因为`Sender`类在同步执行完所有`response`拦截器后就会自动回收入池,如果需要的话,你需要主动调用`persist`方法阻止这种行为.

```
DB.interceptors.after.use(function(){
    this.persist()
    setTimeout(_ => {
        console.log(this.data) // normal
    },0)
    this.release()
},'async')
```
但请注意的是,在使用完后,需要手动调用`release`把它释放,否则它将不能得到复用.

至于释放的时机,你可以合理的分配自己的拦截器.但为了规避一些不必要的错误,尽量不要使用在拦截器里异步访问数据.