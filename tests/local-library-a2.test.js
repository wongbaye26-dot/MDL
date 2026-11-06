const test = require('node:test')
const assert = require('node:assert/strict')

const { buildFingerprint, hashString } = require('../src/core/localLibrary/fingerprintCore')
const { parseCue } = require('../src/core/localLibrary/cue')

test('fingerprint: 同输入稳定，不同 size/内容变化', () => {
  const base = { size: 1000, durationMs: 200000, head: 'aGVhZA==', tail: 'dGFpbA==' }
  const a = buildFingerprint(base)
  assert.equal(a, buildFingerprint({ ...base }))
  assert.notEqual(a, buildFingerprint({ ...base, size: 1001 }))
  assert.notEqual(a, buildFingerprint({ ...base, head: 'aGVhZA==' + 'x' }))
  assert.notEqual(a, buildFingerprint({ ...base, tail: 'dGFpbA==' + 'x' }))
  assert.match(a, /^fp:[0-9a-f]{8}$/)
})

test('fingerprint: hashString 输出稳定 8 位', () => {
  assert.equal(hashString('abc'), hashString('abc'))
  assert.match(hashString('abc'), /^[0-9a-f]{8}$/)
})

const CUE = `\uFEFFREM GENRE Pop
PERFORMER "周杰伦"
TITLE "十一月的萧邦"
FILE "周杰伦 - 十一月的萧邦.flac" WAVE
  TRACK 01 AUDIO
    TITLE "夜曲"
    PERFORMER "周杰伦"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "蓝色风暴"
    INDEX 01 03:45:12
  TRACK 03 AUDIO
    TITLE "发如雪"
    INDEX 01 08:20:00
`

test('cue: 解析 FILE/TRACK/INDEX 与时长', () => {
  const sheet = parseCue(CUE)
  assert.equal(sheet.file, '周杰伦 - 十一月的萧邦.flac')
  assert.equal(sheet.album, '十一月的萧邦')
  assert.equal(sheet.performer, '周杰伦')
  assert.equal(sheet.tracks.length, 3)
  assert.equal(sheet.tracks[0].title, '夜曲')
  assert.equal(sheet.tracks[0].startMs, 0)
  assert.equal(sheet.tracks[1].startMs, 225 * 1000 + 160) // 03:45:12 @75fps
  assert.equal(sheet.tracks[0].durationMs, 225160)
  assert.equal(sheet.tracks[1].performer, '') // 未写则留空，由上层回退专辑艺人
  assert.equal(sheet.tracks[2].startMs, 500 * 1000)
  assert.equal(sheet.tracks[2].durationMs, undefined)
})

test('cue: 缺少 INDEX 的 TRACK 被丢弃', () => {
  const sheet = parseCue(`FILE "a.flac" WAVE
TRACK 01 AUDIO
  TITLE "A"
  INDEX 01 00:00:00
TRACK 02 AUDIO
  TITLE "B"
`)
  assert.equal(sheet.tracks.length, 1)
  assert.equal(sheet.tracks[0].title, 'A')
})
