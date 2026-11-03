import { deleteLocalMusic } from '@/core/localMusic'

/**
 * 无效条目清理：只从曲库里移除记录，**绝不删除磁盘文件**。
 *
 * 传进来的条目一定已经由体检确认过「文件确实不在」（父目录可读、文件 stat 不到），
 * 所以这里直接用 core 的 deleteLocalMusic(item, false) 删记录即可。
 */

export interface InvalidCleanProgress {
  done: number
  total: number
}

export interface InvalidCleanSummary {
  removed: number
  failed: number
}

export interface InvalidCleanCallbacks {
  onProgress: (progress: InvalidCleanProgress) => void
  isAlive: () => boolean
}

export const removeInvalidEntries = async(
  items: LX.Music.MusicInfoLocal[],
  callbacks: InvalidCleanCallbacks,
): Promise<InvalidCleanSummary> => {
  const summary: InvalidCleanSummary = { removed: 0, failed: 0 }
  const total = items.length
  callbacks.onProgress({ done: 0, total })

  for (let i = 0; i < total; i++) {
    if (!callbacks.isAlive()) break
    try {
      // 第二个参数 false：不删文件，只从曲库列表移除
      await deleteLocalMusic(items[i], false)
      summary.removed++
    } catch {
      summary.failed++
    }
    callbacks.onProgress({ done: i + 1, total })
  }

  return summary
}
