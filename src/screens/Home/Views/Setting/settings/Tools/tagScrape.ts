import { updateLocalMusicMeta, updateLocalMusicPic } from '@/core/localMusic'
import { isCoverUsable, readEmbeddedCover } from '@/core/localMusic/cover'
import { scrapeLocalMusic } from '@/core/localMusic/scrape'
import type { TagIncompleteItem } from '@/core/localMusic/scrape'
import { resolveWriteTargets, writeTagsToFile } from './fileWrite'

/**
 * 音乐工具 - 批量刮削标签。
 *
 * 每首歌：联网搜最佳匹配 → 写音频文件（歌名/歌手/专辑，缺封面时顺手补）→ 写回曲库。
 * 文件写不进去（SAF 没授权 / 格式不支持）时退化成「只更新曲库」，不算失败；
 * 网络搜不到「歌名 + 歌手」都对得上的结果才算「未找到」。
 */

export type { TagIncompleteItem, ScrapeMatch } from '@/core/localMusic/scrape'

export interface TagScrapeProgress {
  done: number
  total: number
}

export interface TagScrapeSummary {
  /** 标签写进音频文件的数量 */
  file: number
  /** 只更新了曲库（文件不允许改写）的数量 */
  libraryOnly: number
  /** 联网没找到匹配 / 处理失败的数量 */
  notFound: number
  /** 顺手补上封面的数量 */
  cover: number
  /** 是否被用户中途停止 */
  stopped: boolean
}

export interface TagScrapeCallbacks {
  onProgress: (progress: TagScrapeProgress) => void
  shouldStop: () => boolean
  isAlive: () => boolean
}

/** 文件里或其他地方已经有能显示的封面？有就不用再下载 */
const hasUsableCover = async(item: LX.Music.MusicInfoLocal): Promise<boolean> => {
  const embedded = await readEmbeddedCover(item).catch(() => '')
  if (embedded) return true
  return isCoverUsable(item.meta.picUrl)
}

const scrapeOne = async(
  entry: TagIncompleteItem,
  summary: TagScrapeSummary,
): Promise<void> => {
  const { item } = entry
  const match = await scrapeLocalMusic(item)
  if (!match) {
    summary.notFound++
    return
  }

  // 只补标签，封面写文件交给上面的「封面修复」：刮削批量大，少一次整文件重写快很多。
  // 但封面缺失时可以顺手把网络封面记进曲库，列表马上就能看到图。
  const needCover = !!match.picUrl && !await hasUsableCover(item)

  const targets = await resolveWriteTargets(item)
  const result = await writeTagsToFile(targets, {
    name: match.name,
    singer: match.singer,
    albumName: match.albumName,
  })

  // 标签一定要同步进曲库（文件写失败也要更新，否则列表看起来「没反应」）
  await updateLocalMusicMeta(item, {
    name: match.name,
    singer: match.singer,
    albumName: match.albumName,
  })
  if (result.target) summary.file++
  else summary.libraryOnly++

  if (needCover) {
    await updateLocalMusicPic(item.meta.filePath, match.picUrl)
    summary.cover++
  }
}

/** 批量刮削：可中途停止，已完成的结果保留，返回分项统计 */
export const runTagScrape = async(
  items: TagIncompleteItem[],
  callbacks: TagScrapeCallbacks,
): Promise<TagScrapeSummary> => {
  const summary: TagScrapeSummary = { file: 0, libraryOnly: 0, notFound: 0, cover: 0, stopped: false }
  const total = items.length
  callbacks.onProgress({ done: 0, total })

  for (let i = 0; i < total; i++) {
    if (callbacks.shouldStop() || !callbacks.isAlive()) {
      summary.stopped = true
      break
    }
    try {
      await scrapeOne(items[i], summary)
    } catch {
      // 单首失败（文件被占用 / 写入报错）不影响后面的歌
      summary.notFound++
    }
    callbacks.onProgress({ done: i + 1, total })
  }

  return summary
}
