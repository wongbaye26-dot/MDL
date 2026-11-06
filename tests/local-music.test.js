const test = require('node:test')
const assert = require('node:assert/strict')

const { canReuseScannedFile, toMtimeMs } = require('../src/core/localMusic/scanDiff')
const { buildM3U8, parseM3U, matchM3UEntries } = require('../src/core/localMusic/m3u')
const { isLikelyUnsupportedLocal } = require('../src/core/localMusic/formats')

const makeItem = (filePath, overrides = {}) => ({
  id: `local_${filePath}`,
  name: '夜曲',
  singer: '周杰伦',
  interval: '03:45',
  meta: { filePath, ext: filePath.split('.').pop(), size: 1000, mtime: 1700000000000 },
  ...overrides,
})

test('scanDiff: mtime 缺失/为 0 时不复用', () => {
  const prev = { meta: { mtime: 0, size: 100 } }
  assert.equal(canReuseScannedFile(prev, { path: '/a.flac', mtime: 0, size: 100 }), false)
  assert.equal(canReuseScannedFile(prev, { path: '/a.flac', mtime: 123, size: 100 }), false)
})

test('scanDiff: mtime 与 size 都一致才复用', () => {
  const prev = { meta: { mtime: 123, size: 100 } }
  assert.equal(canReuseScannedFile(prev, { path: '/a.flac', mtime: 123, size: 100 }), true)
  assert.equal(canReuseScannedFile(prev, { path: '/a.flac', mtime: 124, size: 100 }), false)
  assert.equal(canReuseScannedFile(prev, { path: '/a.flac', mtime: 123, size: 101 }), false)
  assert.equal(canReuseScannedFile(undefined, { path: '/a.flac', mtime: 123, size: 100 }), false)
})

test('scanDiff: Date 与数字 mtime 等价', () => {
  assert.equal(toMtimeMs(new Date(1700000000000)), 1700000000000)
  assert.equal(toMtimeMs(1700000000000), 1700000000000)
  assert.equal(toMtimeMs(undefined), 0)
})

test('m3u: 生成 → 解析往返（中文/空格/相对路径）', () => {
  const list = [
    makeItem('/Music/周杰伦 - 夜曲.flac'),
    makeItem('/Music/Album 2/晴天.mp3', { name: '晴天', interval: '04:30' }),
  ]
  const text = buildM3U8(list)
  assert.ok(text.startsWith('#EXTM3U'))
  assert.ok(text.includes('#EXTINF:225,周杰伦 - 夜曲'))
  const entries = parseM3U(text)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].path, '/Music/周杰伦 - 夜曲.flac')
  assert.equal(entries[0].singer, '周杰伦')
  assert.equal(entries[0].name, '夜曲')
  assert.equal(entries[0].duration, 225)
  assert.equal(entries[1].duration, 270)
})

test('m3u: 兼容 BOM/CRLF/注释/空行', () => {
  const text = '\uFEFF#EXTM3U\r\n#PLAYLIST:test\r\n\r\n#EXTINF:123,歌手 - 歌名\r\n/Music/a.flac\r\n'
  const entries = parseM3U(text)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].path, '/Music/a.flac')
  assert.equal(entries[0].name, '歌名')
  assert.equal(entries[0].singer, '歌手')
  assert.equal(entries[0].duration, 123)
})

test('m3u: 三级匹配（路径 → 文件名 → 歌名+歌手+时长）', () => {
  const list = [
    makeItem('/Music/A/夜曲.flac'),
    makeItem('/Music/B/晴天.mp3', { name: '晴天', interval: '04:30' }),
    makeItem('/Music/C/稻香.flac', { name: '稻香', interval: '03:43' }),
  ]
  const entries = [
    { path: '/Music/A/夜曲.flac' },
    { path: '/Other/晴天.mp3' }, // 文件名命中
    { path: '/Other/unknown.mp3', name: '稻香', singer: '周杰伦', duration: 224 }, // 歌名+歌手+时长(±2s)
    { path: '/Other/missing.flac', name: '不存在', singer: '', duration: 0 },
  ]
  const result = matchM3UEntries(entries, list)
  assert.equal(result.entries, 4)
  assert.equal(result.matched.length, 3)
  assert.equal(result.unmatched, 1)
  assert.deepEqual(result.matched.map(item => item.name), ['夜曲', '晴天', '稻香'])
})

test('m3u: 重复行只匹配一次，不重复导入', () => {
  const list = [makeItem('/Music/夜曲.flac')]
  const entries = [
    { path: '/Music/夜曲.flac' },
    { path: '/Music/夜曲.flac' },
  ]
  const result = matchM3UEntries(entries, list)
  assert.equal(result.matched.length, 1)
  assert.equal(result.unmatched, 0)
})

test('formats: APE/WMA/DSF/DFF 标记为可能不支持', () => {
  assert.equal(isLikelyUnsupportedLocal(makeItem('/a.ape')), true)
  assert.equal(isLikelyUnsupportedLocal(makeItem('/a.wma')), true)
  assert.equal(isLikelyUnsupportedLocal(makeItem('/a.dsf')), true)
  assert.equal(isLikelyUnsupportedLocal(makeItem('/a.flac')), false)
  assert.equal(isLikelyUnsupportedLocal(makeItem('/a.mp3')), false)
})

const { getSidecarLrcPath } = require('../src/core/localMusic/lrcPath')

test('lrcPath: 普通路径/无扩展名/查询串/content uri', () => {
  assert.equal(getSidecarLrcPath('/Music/A - B.flac'), '/Music/A - B.lrc')
  assert.equal(getSidecarLrcPath('/Music/A - B'), '/Music/A - B.lrc')
  assert.equal(getSidecarLrcPath('/Music/A - B.flac?x=1'), '/Music/A - B.lrc')
  assert.equal(getSidecarLrcPath('content://media/external/audio/1'), null)
  assert.equal(getSidecarLrcPath(''), null)
})
