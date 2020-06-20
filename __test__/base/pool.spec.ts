import { useDB } from '../../db'
import 'mocha'
import { expect } from 'chai'
import * as sinon from 'sinon'

describe('测试池化功能',() => {
    let requests
    let xhr 
    beforeEach(() => {
        requests = []

        xhr = sinon.useFakeXMLHttpRequest()
        xhr.onCreate = (xhr) => {
            requests.push(xhr)
        }
    })

    afterEach(() => {
        xhr.restore()
    })

    describe('获取DB并自动发送', () => {
        it('status should equal 200',(done) => {
            let config = {
                url: 'http://dataget/test'
            }

            useDB(true,config).then(data => {
                expect(data.status).to.equal(200)
                done()
            })

            requests[0].respond(200)
        })
    })

    describe('获取DB手动发送', () => {
        it('status should equal 200',(done) => {
            let config = {
                url: 'http://dataget/test'
            }

            useDB(config).execute().then(data => {
                expect(data.status).to.equal(200)
                done()
            })

            requests[0].respond(200)
        })
    })
    
})