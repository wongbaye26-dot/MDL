import { deleteLocalMusic } from '@/core/localMusic'
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

/** 批量移除重复条目（只删曲库记录） */
export const removeDuplicateEntries = async(
  groups: DuplicateGroup[],
  callbacks: DuplicateCleanCallbacks,
): Promise<DuplicateCleanSummary> => {
  const extras = collectDuplicateExtras(groups)
  const summary: DuplicateCleanSummary = { removed: 0, failed: 0, stopped: false, failures: [] }
  const total = extras.length
  callbacks.onProgress({ done: 0, total })

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
  if (summary.stopped) lines.push('（任务被中途停止，以上为已完成部分）')
  if (summary.failures.length) lines.push(...summary.failures)
  return lines
}
