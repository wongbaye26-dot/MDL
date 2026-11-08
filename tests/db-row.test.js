const test = require('node:test')
const assert = require('node:assert/strict')
const { TRACK_COLUMNS, buildTrackValues } = require('../src/core/localLibrary/trackColumns')
const { mapLocalTrackToRow } = require('../src/core/localLibrary/mapTrack')

const item = {
  id: 'local_/a.flac', name: '夜曲', singer: '周杰伦', source: 'local', interval: '03:45',
  meta: {
    filePath: '/a.flac', ext: 'flac', size: 100, mtime: 1, albumName: '十一月的萧邦',
    language: '普通话', year: '2005', genre: 'Pop',
  },
}

test('db: TRACK_COLUMNS 与 buildTrackValues 数量一致', () => {
  const row = mapLocalTrackToRow(item)
  assert.equal(buildTrackValues(row, 1).length, TRACK_COLUMNS.length)
})

test('db: language/year/genre 写入对应列', () => {
  const row = mapLocalTrackToRow(item)
  const values = buildTrackValues(row, 1)
  const pick = (col) => values[TRACK_COLUMNS.indexOf(col)]
  assert.equal(pick('language'), '普通话')
  assert.equal(pick('year'), '2005')
  assert.equal(pick('genre'), 'Pop')
  assert.equal(pick('title'), '夜曲')
})
