import { localLibraryRepository } from './repository'
import { mapLocalTrackToRow } from './mapTrack'
import { log } from '@/utils/log'

/**
 * 双写影子表（A2-04）。
 *
 * 旧 JSON 仍是唯一读取源；本地曲库每次保存后，异步把全量 tracks 镜像到 SQLite。
 * 失败只记日志，绝不影响主流程（扫描/删歌/改标签）。A-2 切读前通过差异日志
 * 对比新旧两条链路。
 */

export interface ShadowStatus {
  /** 最近一次同步完成时间（0 = 未跑过） */
  lastAt: number
  /** 同步后 DB 行数 */
  dbCount: number
  /** 本次写入条数 */
  written: number
  durationMs: number
  error: string
}

let timer: ReturnType<typeof setTimeout> | null = null
let pending: LX.Music.MusicInfoLocal[] | null = null
let running = false
let status: ShadowStatus = { lastAt: 0, dbCount: 0, written: 0, durationMs: 0, error: '' }

const writeAll = async(list: LX.Music.MusicInfoLocal[]): Promise<ShadowStatus> => {
  const start = Date.now()
  const rows = list.map(mapLocalTrackToRow)
  await localLibraryRepository.clearTracks()
  for (let i = 0; i < rows.length; i += 500) {
    await localLibraryRepository.upsertTracks(rows.slice(i, i + 500))
  }
  const dbCount = await localLibraryRepository.getTrackCount()
  return { lastAt: Date.now(), dbCount, written: rows.length, durationMs: Date.now() - start, error: '' }
}

const flush = async() => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (running) return
  const list = pending
  pending = null
  if (!list) return
  running = true
  try {
    status = await writeAll(list)
  } catch (error) {
    status = {
      ...status,
      lastAt: Date.now(),
      error: error instanceof Error ? error.message : '影子同步失败',
    }
    log.warn('local library shadow sync failed: ' + status.error)
  } finally {
    // eslint-disable-next-line require-atomic-updates -- 单飞标记，finally 里同步复位
    running = false
    if (pending) scheduleShadowSync(pending)
  }
}

/** 本地曲库保存后调用：1s 防抖，连续扫描/批量操作只写一次 */
export const scheduleShadowSync = (list: LX.Music.MusicInfoLocal[]) => {
  pending = list
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void flush() }, 1000)
}

/** 手动同步（数据库自检/差异排查用） */
export const syncShadowNow = async(list: LX.Music.MusicInfoLocal[]): Promise<ShadowStatus> => {
  pending = null
  if (timer) { clearTimeout(timer); timer = null }
  running = false
  try {
    status = await writeAll(list)
    return status
  } catch (error) {
    status = { ...status, lastAt: Date.now(), error: error instanceof Error ? error.message : '影子同步失败' }
    throw error
  }
}

export const getShadowStatus = (): ShadowStatus => ({ ...status })
