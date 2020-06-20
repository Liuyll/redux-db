import { useDB } from '../../db'
import 'mocha'
import { expect } from 'chai'
import * as sinon from 'sinon'

describe('timeout测试',() => {
    let requests
    let xhr 
    let clock
    let server


    beforeEach(() => {
        server = sinon.createFakeServer()
        clock = sinon.useFakeTimers()
        requests = []

        xhr = sinon.useFakeXMLHttpRequest()
        xhr.onCreate = (xhr) => {
            requests.push(xhr)
        }
        xhr.autoRespond = true
        xhr.autoRespondAfter = 6000
    })

    afterEach(() => {
        xhr.restore()
        server.restore()
        clock.restore()
    })

    describe('timeout终止请求', () => {
        it('status should equal 200',(done) => {
            let config = {
                url: 'http://dataget/test',
                timeout: 5000
            }

            useDB(true,config).then(d => {
                console.log(d)

            }).catch(e => {
                console.log(e)
                done()
            })

            clock.tick(5500)
        })
    })
})