const test = require('node:test')
const assert = require('node:assert/strict')
const { sameText, tagsMatch } = require('../src/core/localMusic/tagCompare')

const wanted = { title: '夜曲', artist: '周杰伦', album: '十一月的萧邦', year: '2005', genre: 'Pop', language: '普通话' }
const tags = { TITLE: '夜曲', ARTIST: '周杰伦', ALBUM: '十一月的萧邦', DATE: '2005', GENRE: 'Pop', LANGUAGE: '普通话' }

test('tagCompare: 完全一致返回 true', () => {
  assert.equal(tagsMatch(tags, wanted), true)
})

test('tagCompare: 任一字段不同返回 false', () => {
  assert.equal(tagsMatch({ ...tags, LANGUAGE: '粤语' }, wanted), false)
  assert.equal(tagsMatch({ ...tags, DATE: '' }, wanted), false)
})

test('tagCompare: 读不到标签返回 false', () => {
  assert.equal(tagsMatch(null, wanted), false)
})

test('tagCompare: 忽略首尾空白', () => {
  assert.equal(sameText(' 夜曲 ', '夜曲'), true)
  assert.equal(tagsMatch({ ...tags, TITLE: ' 夜曲 ' }, wanted), true)
})
