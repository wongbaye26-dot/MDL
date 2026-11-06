import { getAllKeys, getData, saveData } from '@/plugins/storage'
import { getLocalMusicList } from '@/core/localMusic'
import { localLibraryRepository } from './repository'
import { syncShadowNow } from './shadow'

/**
 * A-2 迁移前备份与回滚演练（A2-05）。
 *
 * 备份的是「旧 JSON 事实源」相关 key（曲库/目录/索引/隐藏/回收/播放信息/列表），
 * 不备份 SQLite（可随时重建）。回滚演练只清 DB 再影子同步，验证旧 JSON 未丢。
 */

const BACKUP_KEY = 'local_library_backup_v1'
const EXPLICIT_KEYS = [
  'local_music_list',
  'local_music_dirs',
  'local_music_index_v1',
  'local_music_scan_report_v1',
  'local_music_view_prefs_v1',
  'local_music_hidden_v1',
  'local_music_recycle_v1',
  '@play_info',
  '@user_list',
  '@list_prev_select_id',
]

export interface BackupInfo {
  exists: boolean
  createdAt: number
  keys: number
  tracks: number
  bytes: number
  checksum: string
}

interface BackupFile {
  version: 1
  createdAt: number
  tracks: number
  checksum: string
  entries: Record<string, unknown>
}

const checksumOf = (text: string): string => {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

const collectKeys = async(): Promise<string[]> => {
  const all = await getAllKeys().catch(() => [])
  const playListKeys = all.filter(key => key.startsWith('@list__'))
  return [...new Set([...EXPLICIT_KEYS, ...playListKeys])]
}

const buildBackup = async(): Promise<{ file: BackupFile, keys: number }> => {
  const keys = await collectKeys()
  const entries: Record<string, unknown> = {}
  for (const key of keys) {
    const value = await getData<unknown>(key).catch(() => undefined)
    if (value !== undefined) entries[key] = value
  }
  const serialized = JSON.stringify(entries)
  const file: BackupFile = {
    version: 1,
    createdAt: Date.now(),
    tracks: (entries.local_music_list as unknown[] | undefined)?.length ?? 0,
    checksum: checksumOf(serialized),
    entries,
  }
  return { file, keys: Object.keys(entries).length }
}

export const createLibraryBackup = async(): Promise<BackupInfo> => {
  const { file, keys } = await buildBackup()
  await saveData(BACKUP_KEY, file)
  return {
    exists: true,
    createdAt: file.createdAt,
    keys,
    tracks: file.tracks,
    bytes: JSON.stringify(file.entries).length,
    checksum: file.checksum,
  }
}

export const getBackupInfo = async(): Promise<BackupInfo> => {
  try {
    const file = await getData<BackupFile>(BACKUP_KEY)
    if (!file) return { exists: false, createdAt: 0, keys: 0, tracks: 0, bytes: 0, checksum: '' }
    return {
      exists: true,
      createdAt: file.createdAt,
      keys: Object.keys(file.entries).length,
      tracks: file.tracks,
      bytes: JSON.stringify(file.entries).length,
      checksum: file.checksum,
    }
  } catch {
    return { exists: false, createdAt: 0, keys: 0, tracks: 0, bytes: 0, checksum: '' }
  }
}

export interface RollbackDrillResult {
  ok: boolean
  beforeDb: number
  afterDb: number
  listCount: number
  missing: number
  extra: number
  durationMs: number
  error?: string
}

/** 回滚演练：清空 SQLite → 用旧 JSON 重新影子同步，验证两条链路数量一致 */
export const runRollbackDrill = async(): Promise<RollbackDrillResult> => {
  const start = Date.now()
  const beforeDb = await localLibraryRepository.getTrackCount()
  try {
    await localLibraryRepository.clearAll()
    const list = await getLocalMusicList()
    const status = await syncShadowNow(list)
    return {
      ok: status.dbCount === list.length && status.missing === 0 && status.extra === 0,
      beforeDb,
      afterDb: status.dbCount,
      listCount: list.length,
      missing: status.missing,
      extra: status.extra,
      durationMs: Date.now() - start,
    }
  } catch (error) {
    return {
      ok: false,
      beforeDb,
      afterDb: await localLibraryRepository.getTrackCount().catch(() => 0),
      listCount: 0,
      missing: 0,
      extra: 0,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : '回滚演练失败',
    }
  }
}
