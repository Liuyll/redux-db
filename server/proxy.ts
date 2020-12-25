import express from 'express'
import * as bodyParser from 'body-parser'
import process from 'process'
import { ajax } from '../db/fetch'

const app = express()
app.use((req, res, next) => {
    res.set({
        'Access-Control-Allow-Credentials': true, 
        'Access-Control-Allow-Origin': req.headers.origin || '*', 
        'Access-Control-Allow-Headers': 'X-Requested-With,Content-Type',
        'Access-Control-Allow-Methods': 'PUT,POST,GET,DELETE,OPTIONS',
        'Access-Control-Expose-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8'
    })
    req.method === 'OPTIONS' ? res.status(204).end() : next()
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
function proxy(req, res) {
    const {
        origin,
        method
    } = req.body

    const requestOptions = {
        url: origin,
        type: method,
        headers: req.headers,
        pipe: res
    }
    
    ajax(requestOptions).then(() => {
        res.end()
    },err => {
        res.status(500)
        res.write('Proxy error: retry!')
        res.end()
    })
}

function check(req, res) {
    res.send('normal')
}

app.post('/proxy', proxy)
app.get('/check', check)

process.on('message', (port) => {
    app.listen(port)
})

export function startProxy(port) {
    console.log('success: rexos proxy server is start!') // eslint-disable-line
    app.listen(port)
}