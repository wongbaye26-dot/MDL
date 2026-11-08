const test = require('node:test')
const assert = require('node:assert/strict')
const { getHttpHost } = require('../src/utils/httpHost')

test('httpHost: 解析 http 域名', () => {
  assert.equal(getHttpHost('http://www.kuwo.cn/api?x=1'), 'www.kuwo.cn')
  assert.equal(getHttpHost('http://IMAGE1.KWCDN.KUWO.CN/a.png'), 'image1.kwcdn.kuwo.cn')
  assert.equal(getHttpHost('http://host:8080/a'), 'host')
})

test('httpHost: https/非法地址返回空', () => {
  assert.equal(getHttpHost('https://github.com'), '')
  assert.equal(getHttpHost(''), '')
  assert.equal(getHttpHost('not a url'), '')
})
