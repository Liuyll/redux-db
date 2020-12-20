import { fork } from 'child_process'
import * as net from 'net'
import * as path from 'path'

const startPort = 25918
function detectPort(port: number) {
    return new Promise((resolve, reject) => {
        let server = net.createServer().listen(port)
        server.on('listening',function(){
            server.close()
            resolve(port)
        })
        server.on('error',function(err){
            if(err['code'] == 'EADDRINUSE'){
                port++
                reject(err)
            }
        })        
    })
}

const tryUsePort = function(port,_portAvailableCallback){
    detectPort(port).then((port) => {
        _portAvailableCallback(port)
    }).catch((err) => {
        port++
        tryUsePort(port,_portAvailableCallback)
    })  
}

function startServer() {
    tryUsePort(startPort, (port) => {
        const server = fork(path.resolve(__dirname, 'proxy'))
        server.send(port)
    })
}

export default startServer