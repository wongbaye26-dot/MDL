import { getLyricInfo } from '@/core/music/local'
import { writeFile } from '@/utils/fs'
import { writeTextToSibling } from '@/utils/directoryPicker'

/**
 * 歌词补全：检测出来缺同名 .lrc 的歌，逐首联网/缓存取歌词，再写成同目录同名 .lrc。
 *
 * 写盘分两种地址：
 * - 真实路径（应用私有目录 / 有「所有文件访问」权限的公共目录）：直接 writeFile；
 * - SAF content:// 文档 uri：不能做字符串换扩展名（会生成 URL 编码的垃圾文件名），
 *   交给原生按「父目录 + 文件名」重建，走 writeTextToSibling。
 *
 * 歌词来源用 `getLyricInfo(isRefresh: false)`：它会先读文件内嵌歌词、再读歌词缓存，
 * 都没有才联网搜索并 saveLyric 缓存（下载目录里已经带歌词的歌不会白请求一次）。
 */

export interface LyricFixProgress {
  done: number
  total: number
}

export interface LyricFixSummary {
  /** 成功写出 .lrc 的数量 */
  written: number
  /** 没找到歌词的数量 */
  notFound: number
  /** 有歌词但写文件失败的数量 */
  failed: number
  /** 是否被用户中途停止 */
  stopped: boolean
}

export interface LyricFixCallbacks {
  onProgress: (progress: LyricFixProgress) => void
  shouldStop: () => boolean
  isAlive: () => boolean
}

/** 单首歌词请求最多等 20 秒：音源挂住时不能让整批一直停在某一首 */
const LYRIC_TIMEOUT = 20000

const isSafPath = (path: string) => path.startsWith('content://')

/** 从真实路径 / content:// 文档 uri 里取出文件名（不带路径） */
const baseNameOf = (filePath: string) => {
  try {
    const decoded = filePath.includes('%') ? decodeURIComponent(filePath) : filePath
    const slash = Math.max(decoded.lastIndexOf('/'), decoded.lastIndexOf('%2F'), decoded.lastIndexOf('%2f'))
    return slash >= 0 ? decoded.slice(slash + 1) : decoded
  } catch {
    return filePath
  }
}

/** 同名 .lrc 文件名：x.flac → x.lrc */
const lrcNameOf = (filePath: string) => {
  const name = baseNameOf(filePath)
  const dot = name.lastIndexOf('.')
  return `${dot > 0 ? name.slice(0, dot) : name}.lrc`
}

/** x.flac → x.lrc（仅真实路径） */
const lrcPathOf = (filePath: string) => {
  const slash = filePath.lastIndexOf('/')
  const dot = filePath.lastIndexOf('.')
  if (dot <= slash) return ''
  return `${filePath.slice(0, dot)}.lrc`
}

const withTimeout = async<T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<null>(resolve => { timer = setTimeout(() => { resolve(null) }, ms) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** 把歌词写进文件旁边的 .lrc（带 BOM，Windows / 车机播放器也认） */
const writeLyricFile = async(item: LX.Music.MusicInfoLocal, lyric: string): Promise<boolean> => {
  const filePath = item.meta.filePath
  if (!filePath) return false
  const content = `\ufeff${lyric}`

  if (isSafPath(filePath)) {
    // SAF 文档 uri 交给原生重建同目录文件
    const target = await writeTextToSibling(filePath, lrcNameOf(filePath), content).catch(() => null)
    return !!target
  }

  const lrcPath = lrcPathOf(filePath)
  if (!lrcPath) return false
  await writeFile(lrcPath, content, 'utf8')
  return true
}

/** 批量补歌词：单首失败不影响整批，可中途停止（已完成的结果保留） */
export const runLyricFix = async(
  items: LX.Music.MusicInfoLocal[],
  callbacks: LyricFixCallbacks,
): Promise<LyricFixSummary> => {
  const summary: LyricFixSummary = { written: 0, notFound: 0, failed: 0, stopped: false }
  const total = items.length
  callbacks.onProgress({ done: 0, total })

  for (let i = 0; i < total; i++) {
    if (callbacks.shouldStop() || !callbacks.isAlive()) {
      summary.stopped = true
      break
    }
    const item = items[i]
    try {
      const lyricInfo = await withTimeout(getLyricInfo({ musicInfo: item, isRefresh: false }), LYRIC_TIMEOUT)
      // 超时 / 接口异常：算失败，不占用「没找到」的名额（用户重试可能就好了）
      if (!lyricInfo) {
        summary.failed++
      } else {
        const lyric = (lyricInfo.lyric ?? '').trim()
        if (!lyric) {
          summary.notFound++
        } else if (await writeLyricFile(item, lyric)) {
          summary.written++
        } else {
          summary.failed++
        }
      }
    } catch {
      summary.failed++
    }
    callbacks.onProgress({ done: i + 1, total })
  }

  return summary
}
