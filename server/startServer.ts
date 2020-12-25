import { fork } from 'child_process'
import * as net from 'net'
import * as path from 'path'
import { startProxy } from './proxy'

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
        startProxy(port)
    })
}

function forkServer() {
    tryUsePort(startPort, (port) => {
        const server = fork(path.resolve(__dirname, 'proxy'), { stdio: 'ignore', detached: true })
        server.send(port)
        // protectServer(server)
    })
}

function protectServer(server) {
    server.on('exit', (code, signal) => {
        if(signal) { forkServer() }
    })
}

export {
    forkServer,
    startServer
}

