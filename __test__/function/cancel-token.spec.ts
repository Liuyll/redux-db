import { useDB } from '../../db'
import { RequestType } from '../../db/interface'
import 'mocha'
import { expect } from 'chai'
import * as sinon from 'sinon'

describe('测试cancelToken',() => {
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

    describe('cancelToken功能',() => {
        it('cancelToken构造',(done) => {
            let cancel 
            let config = {
                cancelToken:((c) => cancel = c),
                type: 'get' as RequestType,
                url: 'http://dataget/test'
            }
    
            useDB(true,config)

            expect(cancel).to.be.ok
            done()
        })

        it('cancelToken取消请求',(done) => {
            let cancel 
            let config = {
                cancelToken:((c) => cancel = c),
                type: 'get' as RequestType,
                url: 'http://dataget/test'
            }
    
            useDB(true,config).catch(e => {
                expect(e.msg).to.equal('__FETCH_CANCEL')
                done()
            })

            cancel()
            requests[0].respond(200)
        })
    })
    
})