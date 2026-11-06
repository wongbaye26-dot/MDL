import type { TrackRow } from './repository'

/** MusicInfoLocal → DB 行（纯函数，迁移与双写共用） */
export const mapLocalTrackToRow = (item: LX.Music.MusicInfoLocal): TrackRow => ({
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

export const parseInterval = (interval?: string | null): number => {
  if (!interval) return 0
  const parts = interval.split(':').map(part => Number.parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds * 1000
}
