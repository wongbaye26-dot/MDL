import SQLite from 'react-native-sqlite-2'
import type { SQLResultSet, SQLTransaction, WebsqlDatabase } from 'react-native-sqlite-2'

/**
 * 本地曲库关系型仓库（A-2 / A2-03）。
 *
 * 只负责 SQL 与事务，不把业务规则（扫描/去重/指纹）塞进来；
 * 上层 service 通过本仓库读写。WebSQL 回调 API 在这里统一包成 Promise。
 */

const DB_NAME = 'emomusic_library_v1'
const DB_VERSION = '1'
const DB_SIZE = 50 * 1024 * 1024

export interface TrackRow {
  id: string
  legacyId?: string | null
  fingerprint?: string | null
  mediaId?: string | null
  path: string
  contentUri?: string | null
  title: string
  albumName?: string | null
  albumArtist?: string | null
  durationMs?: number
  format?: string | null
  bitrate?: number | null
  sampleRate?: number | null
  channels?: number | null
  size?: number | null
  mtime?: number | null
  addedAt?: number
  updatedAt?: number
  coverKey?: string | null
  source?: string
  isHidden?: boolean
  isMissing?: boolean
  cuePath?: string | null
  cueTrack?: number | null
  language?: string | null
  year?: string | null
  genre?: string | null
}

export interface BenchmarkResult {
  insertMs: number
  countMs: number
  queryMs: number
  updateMs: number
  deleteMs: number
  totalMs: number
  rows: number
}

const TRACK_COLUMNS = [
  'id', 'legacy_id', 'fingerprint', 'media_id', 'path', 'content_uri', 'title',
  'album_name', 'album_artist', 'duration_ms', 'format', 'bitrate', 'sample_rate',
  'channels', 'size', 'mtime', 'added_at', 'updated_at', 'cover_key', 'source',
  'is_hidden', 'is_missing', 'cue_path', 'cue_track',
  'language', 'year', 'genre',
] as const

/** 把查询结果转成普通对象数组（WebSQL 的 rows 是 native 有序字典） */
const readRows = (result: SQLResultSet): Array<Record<string, unknown>> => {
  const rows: Array<Record<string, unknown>> = []
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i) as Record<string, unknown>)
  return rows
}

/** WebSQL 的 SQL 参数类型是 DOMString，这里统一收口成 string 调用 */
const exec = (
  tx: SQLTransaction,
  sql: string,
  args: unknown[] = [],
  callback?: (transaction: SQLTransaction, result: SQLResultSet) => void,
) => {
  (tx.executeSql as unknown as (
    sql: string,
    args?: unknown[],
    callback?: (transaction: SQLTransaction, result: SQLResultSet) => void,
  ) => void)(sql, args, callback)
}

const mapTrackRow = (row: Record<string, unknown>): TrackRow => ({
  id: String(row.id),
  legacyId: row.legacy_id as string | null,
  fingerprint: row.fingerprint as string | null,
  mediaId: row.media_id as string | null,
  path: String(row.path),
  contentUri: row.content_uri as string | null,
  title: String(row.title),
  albumName: row.album_name as string | null,
  albumArtist: row.album_artist as string | null,
  durationMs: Number(row.duration_ms ?? 0),
  format: row.format as string | null,
  bitrate: row.bitrate == null ? null : Number(row.bitrate),
  sampleRate: row.sample_rate == null ? null : Number(row.sample_rate),
  channels: row.channels == null ? null : Number(row.channels),
  size: row.size == null ? null : Number(row.size),
  mtime: row.mtime == null ? null : Number(row.mtime),
  addedAt: Number(row.added_at ?? 0),
  updatedAt: Number(row.updated_at ?? 0),
  coverKey: row.cover_key as string | null,
  source: String(row.source ?? 'local'),
  isHidden: Number(row.is_hidden ?? 0) === 1,
  isMissing: Number(row.is_missing ?? 0) === 1,
  cuePath: row.cue_path as string | null,
  language: row.language as string | null,
  year: row.year as string | null,
  genre: row.genre as string | null,
  cueTrack: row.cue_track == null ? null : Number(row.cue_track),
})

class LocalLibraryRepository {
  private db: WebsqlDatabase | null = null
  private opening: Promise<WebsqlDatabase> | null = null

  async open(): Promise<WebsqlDatabase> {
    if (this.db) return this.db
    if (this.opening) return await this.opening
    this.opening = new Promise<WebsqlDatabase>((resolve, reject) => {
      try {
        this.db = SQLite.openDatabase(
          { name: DB_NAME, version: DB_VERSION, description: 'EmoMusic local library', size: DB_SIZE },
          (database) => {
            this.db = database
            resolve(database)
          },
        )
      } catch (error) {
        reject(error instanceof Error ? error : new Error('open database failed'))
      }
    }).then(async(db) => {
      await this.ensureSchema(db)
      return db
    }).finally(() => { this.opening = null })
    return await this.opening
  }

  private async ensureSchema(db: WebsqlDatabase) {
    await this.transaction(db, tx => {
      exec(tx, `CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`)
      exec(tx, `CREATE TABLE IF NOT EXISTS migration_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        phase TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        error TEXT,
        old_count INTEGER,
        new_count INTEGER,
        checksum TEXT
      )`)
      exec(tx, `CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        legacy_id TEXT UNIQUE,
        fingerprint TEXT,
        media_id TEXT,
        path TEXT NOT NULL,
        content_uri TEXT,
        title TEXT NOT NULL,
        album_name TEXT,
        album_artist TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        format TEXT,
        bitrate INTEGER,
        sample_rate INTEGER,
        channels INTEGER,
        size INTEGER,
        mtime INTEGER,
        added_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        cover_key TEXT,
        source TEXT NOT NULL DEFAULT 'local',
        is_hidden INTEGER NOT NULL DEFAULT 0,
        is_missing INTEGER NOT NULL DEFAULT 0,
        cue_path TEXT,
        cue_track INTEGER,
        language TEXT,
        year TEXT,
        genre TEXT
      )`)
      // 老库没有这三列：逐列 ALTER，已存在时忽略错误
      for (const col of ['language TEXT', 'year TEXT', 'genre TEXT']) {
        (tx.executeSql as unknown as (sql: string, args?: unknown[], ok?: () => void, err?: () => boolean) => void)(
          `ALTER TABLE tracks ADD COLUMN ${col}`, [], () => {}, () => true,
        )
      }
      exec(tx, 'CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path)')
      exec(tx, 'CREATE INDEX IF NOT EXISTS idx_tracks_fp ON tracks(fingerprint)')
      exec(tx, 'CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_name, album_artist)')
      exec(tx, `CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      )`)
      exec(tx, `CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY(playlist_id, track_id)
      )`)
      exec(tx, `CREATE TABLE IF NOT EXISTS scan_roots (
        path TEXT PRIMARY KEY,
        tree_uri TEXT,
        last_scan_at INTEGER,
        need_auth INTEGER NOT NULL DEFAULT 0
      )`)
      exec(tx, `CREATE TABLE IF NOT EXISTS recycle (
        id TEXT PRIMARY KEY,
        name TEXT,
        singer TEXT,
        original_path TEXT NOT NULL,
        recycle_path TEXT NOT NULL,
        size INTEGER,
        deleted_at INTEGER NOT NULL
      )`)
      exec(tx, `CREATE TABLE IF NOT EXISTS id_map (
        legacy_id TEXT PRIMARY KEY,
        new_id TEXT NOT NULL,
        fingerprint TEXT,
        kind TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`)
    })
  }

  private async transaction(
    db: WebsqlDatabase,
    body: (tx: SQLTransaction) => void,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      db.transaction(
        (tx) => { body(tx) },
        error => { reject(new Error(String(error?.message ?? 'transaction failed'))) },
        () => { resolve() },
      )
    })
  }

  /** 单条/批量 upsert（事务内） */
  async upsertTracks(tracks: TrackRow[]): Promise<number> {
    if (!tracks.length) return 0
    const db = await this.open()
    const now = Date.now()
    await this.transaction(db, tx => {
      for (const track of tracks) {
        // 参数顺序必须和 TRACK_COLUMNS 完全一致；加列时漏改 values 会让整批双写静默失败
        const params = [
          track.id, track.legacyId ?? null, track.fingerprint ?? null, track.mediaId ?? null,
          track.path, track.contentUri ?? null, track.title, track.albumName ?? null,
          track.albumArtist ?? null, track.durationMs ?? 0, track.format ?? null,
          track.bitrate ?? null, track.sampleRate ?? null, track.channels ?? null,
          track.size ?? null, track.mtime ?? null, track.addedAt ?? now, track.updatedAt ?? now,
          track.coverKey ?? null, track.source ?? 'local',
          track.isHidden ? 1 : 0, track.isMissing ? 1 : 0, track.cuePath ?? null, track.cueTrack ?? null,
          track.language ?? null, track.year ?? null, track.genre ?? null,
        ]
        if (params.length !== TRACK_COLUMNS.length) {
          throw new Error(`tracks 列/值数量不一致: columns=${TRACK_COLUMNS.length}, values=${params.length}`)
        }
        exec(tx,
          `INSERT OR REPLACE INTO tracks (${TRACK_COLUMNS.join(',')}) VALUES (${TRACK_COLUMNS.map(() => '?').join(',')})`,
          params,
        )
      }
    })
    return tracks.length
  }

  async getTrackIds(): Promise<string[]> {
    const db = await this.open()
    let ids: string[] = []
    await this.transaction(db, tx => {
      exec(tx, 'SELECT id FROM tracks', [], (_, result) => {
        ids = readRows(result).map(row => String(row.id))
      })
    })
    return ids
  }

  async getTrackCount(): Promise<number> {
    const db = await this.open()
    let count = 0
    await this.transaction(db, tx => {
      exec(tx, 'SELECT COUNT(*) AS c FROM tracks', [], (_, result) => {
        count = Number(result.rows.item(0).c ?? 0)
      })
    })
    return count
  }

  async getTracks(limit = 100, offset = 0): Promise<TrackRow[]> {
    const db = await this.open()
    let rows: TrackRow[] = []
    await this.transaction(db, tx => {
      exec(tx,
        `SELECT ${TRACK_COLUMNS.join(',')} FROM tracks ORDER BY added_at DESC LIMIT ? OFFSET ?`,
        [limit, offset],
        (_, result) => { rows = readRows(result).map(mapTrackRow) },
      )
    })
    return rows
  }

  async getTrackById(id: string): Promise<TrackRow | null> {
    const db = await this.open()
    let row: TrackRow | null = null
    await this.transaction(db, tx => {
      exec(tx,
        `SELECT ${TRACK_COLUMNS.join(',')} FROM tracks WHERE id = ? OR legacy_id = ? LIMIT 1`,
        [id, id],
        (_, result) => {
          const items = readRows(result)
          row = items.length ? mapTrackRow(items[0]) : null
        },
      )
    })
    return row
  }

  async clearTracks(): Promise<void> {
    const db = await this.open()
    await this.transaction(db, tx => { exec(tx, 'DELETE FROM tracks') })
  }

  async getPlaylistCount(): Promise<number> {
    const db = await this.open()
    let count = 0
    await this.transaction(db, tx => {
      exec(tx, 'SELECT COUNT(*) AS c FROM playlists', [], (_, result) => {
        count = Number(result.rows.item(0).c ?? 0)
      })
    })
    return count
  }

  async getPlaylistTrackCount(): Promise<number> {
    const db = await this.open()
    let count = 0
    await this.transaction(db, tx => {
      exec(tx, 'SELECT COUNT(*) AS c FROM playlist_tracks', [], (_, result) => {
        count = Number(result.rows.item(0).c ?? 0)
      })
    })
    return count
  }

  /** 迁移/双写用：写播放列表与条目（调用方负责事务外分批） */
  async upsertPlaylists(
    playlists: Array<{ id: string, type: string, name: string, position: number }>,
    tracks: Array<{ playlistId: string, trackId: string, position: number }>,
  ): Promise<void> {
    const db = await this.open()
    const now = Date.now()
    await this.transaction(db, tx => {
      for (const playlist of playlists) {
        exec(tx,
          'INSERT OR REPLACE INTO playlists (id, type, name, position, created_at, updated_at) VALUES (?,?,?,?,?,?)',
          [playlist.id, playlist.type, playlist.name, playlist.position, now, now],
        )
      }
      for (const track of tracks) {
        exec(tx,
          'INSERT OR REPLACE INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?,?,?,?)',
          [track.playlistId, track.trackId, track.position, now],
        )
      }
    })
  }

  async deleteTracksNotIn(ids: string[]): Promise<void> {
    const db = await this.open()
    await this.transaction(db, tx => {
      if (!ids.length) {
        exec(tx, 'DELETE FROM tracks')
        return
      }
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500)
        exec(tx, `DELETE FROM tracks WHERE id NOT IN (${chunk.map(() => '?').join(',')})`, chunk)
      }
    })
  }

  async getFingerprintRows(): Promise<Array<{ legacyId: string, fingerprint: string }>> {
    const db = await this.open()
    let rows: Array<{ legacyId: string, fingerprint: string }> = []
    await this.transaction(db, tx => {
      exec(tx,
        'SELECT legacy_id, fingerprint FROM tracks WHERE fingerprint IS NOT NULL AND fingerprint != ""',
        [],
        (_, result) => {
          rows = readRows(result).map(row => ({
            legacyId: String(row.legacy_id),
            fingerprint: String(row.fingerprint),
          }))
        },
      )
    })
    return rows
  }

  async getIdMapCount(): Promise<number> {
    const db = await this.open()
    let count = 0
    await this.transaction(db, tx => {
      exec(tx, 'SELECT COUNT(*) AS c FROM id_map', [], (_, result) => {
        count = Number(result.rows.item(0).c ?? 0)
      })
    })
    return count
  }

  async getIdMapEntries(): Promise<Array<{ legacyId: string, newId: string }>> {
    const db = await this.open()
    let rows: Array<{ legacyId: string, newId: string }> = []
    await this.transaction(db, tx => {
      exec(tx, 'SELECT legacy_id, new_id FROM id_map', [], (_, result) => {
        rows = readRows(result).map(row => ({
          legacyId: String(row.legacy_id),
          newId: String(row.new_id),
        }))
      })
    })
    return rows
  }

  async replaceIdMap(entries: Array<{ legacyId: string, newId: string, fingerprint: string | null, kind: string }>): Promise<void> {
    const db = await this.open()
    const now = Date.now()
    await this.transaction(db, tx => {
      exec(tx, 'DELETE FROM id_map')
      for (const entry of entries) {
        exec(tx,
          'INSERT OR REPLACE INTO id_map (legacy_id, new_id, fingerprint, kind, updated_at) VALUES (?,?,?,?,?)',
          [entry.legacyId, entry.newId, entry.fingerprint, entry.kind, now],
        )
      }
    })
  }

  /** A-3：把 tracks.id / playlist_tracks.track_id 从 legacy id 切到 fp id（可反向调用回滚） */
  async migrateTrackIds(mapping: Array<[string, string]>): Promise<{ updated: number, conflicts: number, skipped: number, playlistUpdated: number }> {
    const db = await this.open()
    let existing = new Set<string>()
    await this.transaction(db, tx => {
      exec(tx, 'SELECT id FROM tracks', [], (_, result) => {
        existing = new Set(readRows(result).map(row => String(row.id)))
      })
    })
    const pairs = mapping.filter(([from, to]) => from && to && from !== to)
    const safe = pairs.filter(([from, to]) => {
      if (!existing.has(from)) return false
      if (existing.has(to)) return false
      return true
    })
    const conflicts = pairs.filter(([from, to]) => existing.has(from) && existing.has(to)).length
    const skipped = pairs.length - safe.length - conflicts
    let playlistUpdated = 0
    await this.transaction(db, tx => {
      for (const [from, to] of safe) {
        exec(tx, 'UPDATE tracks SET id = ?, updated_at = ? WHERE id = ? OR legacy_id = ?', [to, Date.now(), from, from])
        exec(tx, 'UPDATE playlist_tracks SET track_id = ? WHERE track_id = ?', [to, from], (_, result) => { playlistUpdated += result.rowsAffected })
      }
    })
    return { updated: safe.length, conflicts, skipped, playlistUpdated }
  }

  /** 回填指纹（id 暂不切换，A2-07 切读时再改主键） */
  async updateTrackFingerprint(legacyId: string, fingerprint: string): Promise<number> {
    const db = await this.open()
    let affected = 0
    await this.transaction(db, tx => {
      exec(tx,
        'UPDATE tracks SET fingerprint = ?, updated_at = ? WHERE legacy_id = ? OR id = ?',
        [fingerprint, Date.now(), legacyId, legacyId],
        (_, result) => { affected = result.rowsAffected },
      )
    })
    return affected
  }

  /** 仅用于 A-2 迁移预演/自检，清空曲库与列表表（不动回收站文件） */
  async clearAll(): Promise<void> {
    const db = await this.open()
    await this.transaction(db, tx => {
      exec(tx, 'DELETE FROM playlist_tracks')
      exec(tx, 'DELETE FROM playlists')
      exec(tx, 'DELETE FROM tracks')
    })
  }

  /**
   * 运行期基准：10k 首插入/计数/专辑查询/更新/清空。
   * 只在开发/诊断入口调用；不写真实曲库（固定 id 前缀 bench_）。
   */
  async runBenchmark(count = 10000): Promise<BenchmarkResult> {
    const db = await this.open()
    const start = Date.now()
    const insertStart = Date.now()
    await new Promise<void>((resolve, reject) => {
      db.transaction(
        tx => {
          exec(tx, 'DELETE FROM tracks WHERE id LIKE ?', ['bench_%'])
          for (let i = 0; i < count; i++) {
            exec(tx,
              'INSERT OR REPLACE INTO tracks (id, path, title, album_name, album_artist, duration_ms, format, size, added_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
              [`bench_${i}`, `/bench/${i}.flac`, `歌曲${i}`, `专辑${i % 500}`, `艺人${i % 200}`, 180000 + i, 'flac', 1024, start + i, start + i],
            )
          }
        },
        error => { reject(new Error(String(error?.message ?? 'bench insert failed'))) },
        () => { resolve() },
      )
    })
    const insertMs = Date.now() - insertStart

    const countStart = Date.now()
    const rows = await this.getTrackCount()
    const countMs = Date.now() - countStart

    const queryStart = Date.now()
    let groups = 0
    await this.transaction(db, tx => {
      exec(tx,
        'SELECT album_name, COUNT(*) AS c FROM tracks WHERE id LIKE ? GROUP BY album_name ORDER BY c DESC LIMIT 100',
        ['bench_%'],
        (_, result) => { groups = result.rows.length },
      )
    })
    const queryMs = Date.now() - queryStart

    const updateStart = Date.now()
    await this.transaction(db, tx => {
      exec(tx, 'UPDATE tracks SET is_hidden = 1 WHERE id LIKE ?', ['bench_%'])
    })
    const updateMs = Date.now() - updateStart

    const deleteStart = Date.now()
    await this.transaction(db, tx => {
      exec(tx, 'DELETE FROM tracks WHERE id LIKE ?', ['bench_%'])
    })
    const deleteMs = Date.now() - deleteStart

    return {
      insertMs,
      countMs,
      queryMs,
      updateMs,
      deleteMs,
      totalMs: Date.now() - start,
      rows: rows + groups,
    }
  }
}

export const localLibraryRepository = new LocalLibraryRepository()
export { LocalLibraryRepository }
