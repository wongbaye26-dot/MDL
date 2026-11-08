import type { TrackRow } from './repository'

/** tracks 表列顺序：SQL 与 values 必须严格按这个顺序生成 */
export const TRACK_COLUMNS = [
  'id', 'legacy_id', 'fingerprint', 'media_id', 'path', 'content_uri', 'title',
  'album_name', 'album_artist', 'duration_ms', 'format', 'bitrate', 'sample_rate',
  'channels', 'size', 'mtime', 'added_at', 'updated_at', 'cover_key', 'source',
  'is_hidden', 'is_missing', 'cue_path', 'cue_track',
  'language', 'year', 'genre',
] as const

export const buildTrackValues = (track: TrackRow, now: number): unknown[] => [
  track.id, track.legacyId ?? null, track.fingerprint ?? null, track.mediaId ?? null,
  track.path, track.contentUri ?? null, track.title, track.albumName ?? null,
  track.albumArtist ?? null, track.durationMs ?? 0, track.format ?? null,
  track.bitrate ?? null, track.sampleRate ?? null, track.channels ?? null,
  track.size ?? null, track.mtime ?? null, track.addedAt ?? now, track.updatedAt ?? now,
  track.coverKey ?? null, track.source ?? 'local',
  track.isHidden ? 1 : 0, track.isMissing ? 1 : 0, track.cuePath ?? null, track.cueTrack ?? null,
  track.language ?? null, track.year ?? null, track.genre ?? null,
]
