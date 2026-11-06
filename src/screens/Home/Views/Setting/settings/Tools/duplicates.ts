import { deleteLocalMusic } from '@/core/localMusic'
import { addListMusics, getListMusics, getUserLists, removeListMusics } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import settingState from '@/store/setting/state'
import { cleanSongName } from '@/utils/songName'
import type { DuplicateGroup } from './health'
import { buildReportLine } from './report'

/**
 * 重复歌曲清理：只从**曲库列表**里移除多余的记录，绝不删除磁盘文件。
 *
 * 每组保留体积最大的一首（体检时已经排好序，items[0] 是建议保留的），
 * 其余多出来的条目用 deleteLocalMusic(item, false) 移除记录。
 * 用户如果发现留错了，重新扫描目录就能把文件加回来。
 */

export interface DuplicateCleanProgress {
  done: number
  total: number
}

export interface DuplicateCleanSummary {
  removed: number
  failed: number
  stopped: boolean
  failures: string[]
  /** 清理前把「多余条目」在收藏/歌单里的引用替换为保留曲目的列表数（D-09 补） */
  referencesUpdated: number
}

export interface DuplicateCleanCallbacks {
  onProgress: (progress: DuplicateCleanProgress) => void
  isAlive: () => boolean
}

/** 展开所有「多余」的重复条目（每组保留第一首） */
export const collectDuplicateExtras = (groups: DuplicateGroup[]): LX.Music.MusicInfoLocal[] => {
  const extras: LX.Music.MusicInfoLocal[] = []
  for (const group of groups) {
    for (let i = 1; i < group.items.length; i++) extras.push(group.items[i])
  }
  return extras
}

/**
 * 清理前迁移引用（D-09 补）：收藏 / 用户歌单里如果用的是「多余条目」，
 * 先用「保留条目」替换，再删除曲库记录，避免清理后收藏/歌单里出现失效歌。
 *
 * TEMP（稍后播放）队列在内存里，切歌/重启会按曲库重建，本函数不处理。
 */
const migrateDuplicateReferences = async(groups: DuplicateGroup[]): Promise<number> => {
  if (!groups.length) return 0
  const keepByExtra = new Map<string, LX.Music.MusicInfoLocal>()
  for (const group of groups) {
    const keep = group.items[0]
    for (let i = 1; i < group.items.length; i++) keepByExtra.set(group.items[i].id, keep)
  }
  const userLists = await getUserLists().catch(() => [])
  const listIds = [LIST_IDS.LOVE, ...userLists.map(list => list.id)]
  let updatedLists = 0
  for (const listId of listIds) {
    const musics = await getListMusics(listId).catch(() => [])
    if (!musics.length) continue
    const extraIds: string[] = []
    const keepItems: LX.Music.MusicInfoLocal[] = []
    const existingIds = new Set(musics.map(item => item.id))
    for (const music of musics) {
      const keep = keepByExtra.get(music.id)
      if (!keep) continue
      extraIds.push(music.id)
      if (!existingIds.has(keep.id)) {
        existingIds.add(keep.id)
        keepItems.push(keep)
      }
    }
    if (!extraIds.length) continue
    try {
      await removeListMusics(listId, extraIds)
      if (keepItems.length) await addListMusics(listId, keepItems, settingState.setting['list.addMusicLocationType'])
      updatedLists += 1
    } catch {
      // 单个列表迁移失败不阻断清理；失败的引用会在下次体检时继续被识别
    }
  }
  return updatedLists
}

/** 批量移除重复条目（只删曲库记录） */
export const removeDuplicateEntries = async(
  groups: DuplicateGroup[],
  callbacks: DuplicateCleanCallbacks,
): Promise<DuplicateCleanSummary> => {
  const extras = collectDuplicateExtras(groups)
  const summary: DuplicateCleanSummary = { removed: 0, failed: 0, stopped: false, failures: [], referencesUpdated: 0 }
  const total = extras.length
  callbacks.onProgress({ done: 0, total })
  summary.referencesUpdated = await migrateDuplicateReferences(groups)

  for (let i = 0; i < total; i++) {
    if (!callbacks.isAlive()) {
      summary.stopped = true
      break
    }
    const item = extras[i]
    try {
      // 第二个参数 false：不删文件，只从曲库移除
      await deleteLocalMusic(item, false)
      summary.removed++
    } catch {
      summary.failed++
      summary.failures.push(buildReportLine('重复', cleanSongName(item.name, item.singer), item.singer, '从曲库移除失败'))
    }
    callbacks.onProgress({ done: i + 1, total })
  }

  return summary
}

export const buildDuplicateReport = (summary: DuplicateCleanSummary): string[] => {
  const lines = [`已从曲库移除 ${summary.removed} 首重复条目（未删除任何文件），失败 ${summary.failed} 首`]
  if (summary.referencesUpdated) lines.push(`已替换 ${summary.referencesUpdated} 个收藏/歌单里的重复引用`)
  if (summary.stopped) lines.push('（任务被中途停止，以上为已完成部分）')
  if (summary.failures.length) lines.push(...summary.failures)
  return lines
}
