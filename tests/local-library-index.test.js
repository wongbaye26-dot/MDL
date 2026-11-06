const test = require('node:test')
const assert = require('node:assert/strict')

const { buildLibraryIndex, normalizeGroupKey, splitArtists } = require('../src/core/localMusic/libraryIndex')

const makeItem = (i, overrides = {}) => ({
  id: `local_/Music/Album${i % 500}/Artist${i % 200} - 歌曲${i}.flac`,
  name: `歌曲${i}`,
  singer: `Artist${i % 200}`,
  interval: '03:45',
  meta: {
    filePath: `/Music/Album${i % 500}/Artist${i % 200} - 歌曲${i}.flac`,
    ext: 'flac',
    albumName: `Album${i % 500}`,
    size: 1024,
    mtime: 1700000000000 - i,
  },
  ...overrides,
})

test('索引：专辑/艺人/文件夹分组与封面聚合', () => {
  const list = [
    makeItem(0),
    makeItem(1),
    makeItem(2, { singer: '周杰伦/方文山', meta: { ...makeItem(2).meta, albumName: '十一月的萧邦' } }),
  ]
  const index = buildLibraryIndex(list)
  assert.equal(index.trackCount, 3)
  assert.equal(Object.keys(index.albums).length, 3)
  assert.equal(Object.keys(index.artists).length, 4)
  assert.equal(Object.keys(index.folders).length, 3)
  const artist = index.artists[normalizeGroupKey('周杰伦')]
  assert.ok(artist)
  assert.equal(artist.count, 1)
  assert.equal(artist.songIds[0], list[2].id)
  assert.deepEqual(splitArtists('周杰伦/方文山'), ['周杰伦', '方文山'])
  assert.deepEqual(splitArtists(''), ['未知歌手'])
})

test('索引：未知专辑/未知歌手有稳定 key', () => {
  const item = makeItem(1, { singer: '', meta: { ...makeItem(1).meta, albumName: '' } })
  const index = buildLibraryIndex([item])
  assert.equal(index.albums[normalizeGroupKey('未知专辑')].name, '未知专辑')
  assert.equal(index.artists[normalizeGroupKey('未知歌手')].name, '未知歌手')
})

test('索引：10k 曲库构建耗时与结构（性能基线）', () => {
  const list = Array.from({ length: 10000 }, (_, i) => makeItem(i))
  const heapBefore = process.memoryUsage().heapUsed
  const start = performance.now()
  const index = buildLibraryIndex(list)
  const cost = performance.now() - start
  const heapCost = (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024
  console.log(`[perf] buildLibraryIndex 10k: ${cost.toFixed(1)}ms, heap +${heapCost.toFixed(1)}MB`)
  assert.equal(index.trackCount, 10000)
  assert.equal(Object.keys(index.albums).length, 500)
  assert.equal(Object.keys(index.artists).length, 200)
  assert.equal(Object.keys(index.folders).length, 500)
  assert.ok(index.recentIds.length <= 500)
  assert.ok(cost < 2000, `10k 索引构建过慢: ${cost.toFixed(1)}ms`)
})
