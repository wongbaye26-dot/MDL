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
  language: item.meta.language ?? null,
  year: item.meta.year ?? null,
  genre: item.meta.genre ?? null,
})

export const parseInterval = (interval?: string | null): number => {
  if (!interval) return 0
  const parts = interval.split(':').map(part => Number.parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds * 1000
}

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}

/** DB 行 → MusicInfoLocal（切读适配层用；保持旧 UI/播放链路字段不变） */
export const mapRowToLocalTrack = (row: TrackRow): LX.Music.MusicInfoLocal => ({
  id: row.id,
  name: row.title,
  singer: row.albumArtist ?? '',
  source: 'local',
  interval: formatDuration(row.durationMs ?? 0),
  meta: {
    filePath: row.path,
    ext: row.format ?? '',
    size: row.size ?? 0,
    mtime: row.mtime ?? 0,
    bitrate: row.bitrate != null ? String(row.bitrate) : undefined,
    sampleRate: row.sampleRate != null ? String(row.sampleRate) : undefined,
    albumName: row.albumName ?? '',
    picUrl: row.coverKey ?? undefined,
    contentUri: row.contentUri ?? undefined,
    songId: row.mediaId ?? row.path,
    language: row.language ?? undefined,
    year: row.year ?? undefined,
    genre: row.genre ?? undefined,
  },
})
