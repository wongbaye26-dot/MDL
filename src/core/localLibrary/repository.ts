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
        cue_track INTEGER
      )`)
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
      exec(tx, 'PRAGMA journal_mode = WAL')
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
        exec(tx,
          `INSERT OR REPLACE INTO tracks (${TRACK_COLUMNS.join(',')}) VALUES (${TRACK_COLUMNS.map(() => '?').join(',')})`,
          [
            track.id, track.legacyId ?? null, track.fingerprint ?? null, track.mediaId ?? null,
            track.path, track.contentUri ?? null, track.title, track.albumName ?? null,
            track.albumArtist ?? null, track.durationMs ?? 0, track.format ?? null,
            track.bitrate ?? null, track.sampleRate ?? null, track.channels ?? null,
            track.size ?? null, track.mtime ?? null, track.addedAt ?? now, track.updatedAt ?? now,
            track.coverKey ?? null, track.source ?? 'local',
            track.isHidden ? 1 : 0, track.isMissing ? 1 : 0, track.cuePath ?? null, track.cueTrack ?? null,
          ],
        )
      }
    })
    return tracks.length
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
