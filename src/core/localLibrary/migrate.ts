import { getLocalMusicList } from '@/core/localMusic'
import { getListMusics, getUserLists } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import { localLibraryRepository, type TrackRow } from './repository'

/**
 * A-2 迁移预演（A2-04/A2-05）。
 *
 * 把现有 JSON 曲库 + 收藏/用户歌单写进 SQLite，**不切换读取源**，只做
 * 数量/checksum 校验；旧 JSON 不动。真正切读需要走 ADR 的五阶段门禁。
 */

export interface MigrationPreview {
  tracks: number
  playlists: number
  playlistTracks: number
  dbTracks: number
  dbPlaylists: number
  dbPlaylistTracks: number
  durationMs: number
  checksum: string
  skippedOnline: number
}

const isLocalItem = (item: LX.Music.MusicInfo | LX.Download.ListItem): item is LX.Music.MusicInfoLocal => {
  return 'meta' in item && !!item.meta && typeof item.meta === 'object' && 'filePath' in item.meta
}

const toTrackRow = (item: LX.Music.MusicInfoLocal): TrackRow => ({
  id: item.id,
  legacyId: item.id,
  fingerprint: null,
  mediaId: null,
  path: item.meta.filePath,
  contentUri: item.meta.contentUri ?? null,
  title: item.name,
  albumName: item.meta.albumName ?? null,
  albumArtist: item.singer ?? null,
  durationMs: parseInterval(item.interval),
  format: item.meta.ext ?? null,
  bitrate: item.meta.bitrate ? Number.parseInt(String(item.meta.bitrate), 10) || null : null,
  sampleRate: item.meta.sampleRate ? Number.parseInt(String(item.meta.sampleRate), 10) || null : null,
  channels: null,
  size: item.meta.size ?? null,
  mtime: item.meta.mtime ?? null,
  addedAt: item.meta.mtime ?? Date.now(),
  updatedAt: Date.now(),
  coverKey: item.meta.picUrl ?? null,
  source: 'local',
  isHidden: false,
  isMissing: false,
})

const parseInterval = (interval?: string | null): number => {
  if (!interval) return 0
  const parts = interval.split(':').map(part => Number.parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds * 1000
}

const checksumOf = (trackIds: string[], playlistTrackIds: string[]): string => {
  let hash = 2166136261
  const payload = `${trackIds.length}|${playlistTrackIds.length}|${trackIds.join(',')}|${playlistTrackIds.join(',')}`
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export const runMigrationDryRun = async(): Promise<MigrationPreview> => {
  const start = Date.now()
  const localList = await getLocalMusicList()
  const trackRows = localList.map(toTrackRow)
  await localLibraryRepository.clearAll()
  // 分批写，避免单事务参数过多；每批 500
  for (let i = 0; i < trackRows.length; i += 500) {
    await localLibraryRepository.upsertTracks(trackRows.slice(i, i + 500))
  }

  const userLists = await getUserLists().catch(() => [])
  const playlists = [
    { id: LIST_IDS.DEFAULT, type: 'default', name: '默认列表', position: 0 },
    { id: LIST_IDS.LOVE, type: 'love', name: '我的收藏', position: 1 },
    ...userLists.map((list, index) => ({ id: list.id, type: 'user', name: list.name, position: index + 2 })),
  ]
  const playlistTracks: Array<{ playlistId: string, trackId: string, position: number }> = []
  let skippedOnline = 0
  const localIds = new Set(trackRows.map(row => row.id))
  for (const playlist of playlists) {
    const musics = await getListMusics(playlist.id).catch(() => [])
    musics.forEach((music, index) => {
      if (!isLocalItem(music)) { skippedOnline += 1; return }
      if (!localIds.has(music.id)) return
      playlistTracks.push({ playlistId: playlist.id, trackId: music.id, position: index })
    })
  }
  await localLibraryRepository.upsertPlaylists(playlists, playlistTracks)

  const [dbTracks, dbPlaylists, dbPlaylistTracks] = await Promise.all([
    localLibraryRepository.getTrackCount(),
    localLibraryRepository.getPlaylistCount(),
    localLibraryRepository.getPlaylistTrackCount(),
  ])

  return {
    tracks: trackRows.length,
    playlists: playlists.length,
    playlistTracks: playlistTracks.length,
    dbTracks,
    dbPlaylists,
    dbPlaylistTracks,
    durationMs: Date.now() - start,
    checksum: checksumOf(trackRows.map(row => row.id), playlistTracks.map(item => `${item.playlistId}:${item.trackId}`)),
    skippedOnline,
  }
}
