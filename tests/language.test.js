const test = require('node:test')
const assert = require('node:assert/strict')
const { detectLanguage, isCantonese, isChineseLanguage } = require('../src/utils/language')

test('language: 粤语用字优先判粤语', () => {
  assert.equal(detectLanguage('我唔係好明你講咩'), '粤语')
  assert.equal(detectLanguage('呢首歌真係好聽'), '粤语')
})

test('language: 繁体比例高判粤语', () => {
  assert.equal(detectLanguage('為什麼這愛這麼難'), '粤语')
})

test('language: 粤语歌手兜底', () => {
  assert.equal(detectLanguage('這晚在街中偶遇心中的她', '李克勤 护花使者'), '粤语')
})

test('language: 普通话/日语/韩语/英语', () => {
  assert.equal(detectLanguage('我们都在不断赶路忘记了出路'), '普通话')
  assert.equal(detectLanguage('君のことが好きだよ'), '日文')
  assert.equal(detectLanguage('사랑해요 그리고 고마워요'), '韩文')
  assert.equal(detectLanguage('I keep dancing on my own tonight'), '英文')
})

test('language: helper 判定', () => {
  assert.equal(isCantonese('粤语'), true)
  assert.equal(isCantonese('普通话'), false)
  assert.equal(isChineseLanguage('普通话'), true)
  assert.equal(isChineseLanguage('英文'), false)
})
