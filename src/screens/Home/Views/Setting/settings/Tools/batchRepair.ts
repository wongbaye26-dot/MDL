import { cleanSongName } from '@/utils/songName'
import { fixCovers } from './coverFix'
import type { LibraryHealth } from './health'
import { runLyricFix } from './lyricFix'
import { buildReportLine } from './report'
import { runTagScrape } from './tagScrape'

/**
 * 一键修复：先缺什么补什么（封面 → 标签 → 歌词），串行执行。
 *
 * 为什么串行而不是并行：
 * 三个批量任务都会整文件重写（写标签/封面）并大量联网，并行会让真机 IO 和网络
 * 互相拖慢，还会触发工具锁互斥；串行还能保证「刮削补到的封面」不会被后面的
 * 补封面流程重复处理。每一步都会尊重用户的中途停止。
 */

export interface BatchRepairProgress {
  done: number
  total: number
  /** 当前阶段的文字说明（补封面 / 刮削标签 / 补歌词） */
  label: string
}

export interface BatchRepairSummary {
  coverLocal: number
  coverNetwork: number
  coverLibraryOnly: number
  coverNotFound: number
  tagFile: number
  tagLibraryOnly: number
  tagNotFound: number
  lyricWritten: number
  lyricNotFound: number
  lyricFailed: number
  stopped: boolean
  /** 失败 / 未找到清单（每行：类别｜歌名 - 歌手｜说明） */
  failures: string[]
}

export interface BatchRepairCallbacks {
  onProgress: (progress: BatchRepairProgress) => void
  shouldStop: () => boolean
  isAlive: () => boolean
}

/** 本次「一键修复」会处理多少首（用于进度条总数） */
export const countBatchRepairTotal = (health: LibraryHealth): number => {
  return health.healableCovers.length +
    health.missingCovers.length +
    health.tagIncomplete.length +
    health.missingLyrics.length
}

const createEmptySummary = (): BatchRepairSummary => ({
  coverLocal: 0,
  coverNetwork: 0,
  coverLibraryOnly: 0,
  coverNotFound: 0,
  tagFile: 0,
  tagLibraryOnly: 0,
  tagNotFound: 0,
  lyricWritten: 0,
  lyricNotFound: 0,
  lyricFailed: 0,
  stopped: false,
  failures: [],
})

export const runBatchRepair = async(
  health: LibraryHealth,
  callbacks: BatchRepairCallbacks,
): Promise<BatchRepairSummary> => {
  const summary = createEmptySummary()
  const total = countBatchRepairTotal(health)
  const isAlive = () => callbacks.isAlive() && !callbacks.shouldStop()
  let base = 0
  const pushFailure = (category: string, item: LX.Music.MusicInfoLocal, reason: string) => {
    summary.failures.push(buildReportLine(category, cleanSongName(item.name, item.singer), item.singer, reason))
  }

  /* ① 封面：先写回本地已有的，再联网找缺失的 */
  const coverTotal = health.healableCovers.length + health.missingCovers.length
  if (coverTotal) {
    callbacks.onProgress({ done: base, total, label: '补封面' })
    const result = await fixCovers(health.healableCovers, health.missingCovers, {
      onProgress: progress => { callbacks.onProgress({ done: base + progress.done, total, label: '补封面' }) },
      isAlive,
      onItemResult: (item, status) => {
        if (status === 'local') summary.coverLocal++
        else if (status === 'network') summary.coverNetwork++
        else if (status === 'libraryOnly') summary.coverLibraryOnly++
        else {
          summary.coverNotFound++
          pushFailure('封面', item, '联网未找到可用封面')
        }
      },
    })
    summary.coverLocal = result.local
    summary.coverNetwork = result.network
    summary.coverLibraryOnly = result.libraryOnly
    summary.coverNotFound = result.notFound
    base += coverTotal
    if (!isAlive()) {
      summary.stopped = true
      return summary
    }
  }

  /* ② 标签：歌名+歌手对不上不写，宁可少补不写错 */
  if (health.tagIncomplete.length) {
    callbacks.onProgress({ done: base, total, label: '刮削标签' })
    const result = await runTagScrape(health.tagIncomplete, {
      onProgress: progress => { callbacks.onProgress({ done: base + progress.done, total, label: '刮削标签' }) },
      shouldStop: () => !isAlive(),
      isAlive,
      onItemResult: (item, status) => {
        if (status === 'notFound') pushFailure('标签', item, '未找到歌名+歌手对得上的结果')
      },
    })
    summary.tagFile = result.file
    summary.tagLibraryOnly = result.libraryOnly
    summary.tagNotFound = result.notFound
    summary.stopped = result.stopped
    base += health.tagIncomplete.length
    if (summary.stopped) return summary
  }

  /* ③ 歌词：最后补，刮削可能已经顺带更新了歌名/歌手，检索更准 */
  if (health.missingLyrics.length) {
    callbacks.onProgress({ done: base, total, label: '补歌词' })
    const result = await runLyricFix(health.missingLyrics, {
      onProgress: progress => { callbacks.onProgress({ done: base + progress.done, total, label: '补歌词' }) },
      shouldStop: () => !isAlive(),
      isAlive,
      onItemResult: (item, status) => {
        if (status === 'notFound') pushFailure('歌词', item, '没找到歌词')
        else if (status === 'failed') pushFailure('歌词', item, '获取或写入失败')
      },
    })
    summary.lyricWritten = result.written
    summary.lyricNotFound = result.notFound
    summary.lyricFailed = result.failed
    summary.stopped = summary.stopped || result.stopped
  }

  return summary
}

/** 把汇总 + 失败清单整理成可复制 / 可导出的文本行 */
export const buildBatchRepairReport = (summary: BatchRepairSummary): string[] => {
  const lines = [
    `封面：本地写回 ${summary.coverLocal}，联网写入 ${summary.coverNetwork}，仅曲库 ${summary.coverLibraryOnly}，未找到 ${summary.coverNotFound}`,
    `标签：写入文件 ${summary.tagFile}，仅曲库 ${summary.tagLibraryOnly}，未找到 ${summary.tagNotFound}`,
    `歌词：写入 ${summary.lyricWritten}，无歌词 ${summary.lyricNotFound}，失败 ${summary.lyricFailed}`,
  ]
  if (summary.stopped) lines.push('（任务被中途停止，以上为已完成部分）')
  lines.push(`失败 / 未找到清单（${summary.failures.length} 条）：`)
  if (summary.failures.length) lines.push(...summary.failures)
  else lines.push('无')
  return lines
}
