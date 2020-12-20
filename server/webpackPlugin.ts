import startServer from './startServer'

function rexosProxyPlugin() {
    startServer()
}

rexosProxyPlugin.prototype.apply = function(compile) {
    compile.plugin('emit', (_, cb) => {
        cb()
    })
}

export default rexosProxyPlugin