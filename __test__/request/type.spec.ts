import { DB } from '../../db'
import 'mocha'
import { expect } from 'chai'
import * as sinon from 'sinon'

describe('测试普通请求',() => {
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

    describe('get请求', () => {
        it('status should equal 200',(done) => {
            let config = {
                url: 'http://dataget/test'
            }

            new DB(config).execute().then(data => {
                expect(data.status).to.equal(200)
                done()
            })

            requests[0].respond(200)
        })
    })

    describe('post请求', () => {
        it('status should equal 200', (done) => {
            let config = {
                type: 'post',
                url: 'http://dataget/test'
            }

            new DB(config as any).execute().then(data => {
                expect(data.status).to.equal(200)
                done()
            })

            requests[0].respond(200)
        })
    })

    describe('put请求', () => {
        it('status should equal 200', (done) => {
            let config = {
                type: 'put',
                url: 'http://dataget/test',
            }

            new DB(config as any).execute().then(data => {
                expect(data.status).to.equal(200)
                done()
            })

            requests[0].respond(200)
        })
    })
})