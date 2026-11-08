import { updateLocalMusicMeta, updateLocalMusicPic } from '@/core/localMusic'
import { isCoverUsable, readEmbeddedCover } from '@/core/localMusic/cover'
import { scrapeLocalMusic } from '@/core/localMusic/scrape'
import { splitNameAndSinger } from '@/utils/songName'
import { isMusicBrainzCandidate, searchMusicBrainz } from '@/core/localMusic/musicbrainz'
import type { TagIncompleteItem } from '@/core/localMusic/scrape'
import { resolveWriteTargets, writeTagsToFile } from './fileWrite'
import { readFlacTags } from '@/utils/flacTag'
import { log } from '@/utils/log'
import { sameText, tagsMatch } from '@/core/localMusic/tagCompare'

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

export type TagScrapeItemStatus = 'file' | 'libraryOnly' | 'notFound'

export interface TagScrapeCallbacks {
  onProgress: (progress: TagScrapeProgress) => void
  shouldStop: () => boolean
  isAlive: () => boolean
  /** 单首处理结果回调（批量修复用来收集失败清单） */
  onItemResult?: (item: LX.Music.MusicInfoLocal, status: TagScrapeItemStatus) => void
}

/** 去掉扩展名，并把「歌名 - 歌手」拆成纯歌名，避免把文件名写进 TITLE */
const cleanTitle = (name: string, singer: string) => {
  const noExt = (name ?? '').replace(/\.[a-z0-9]{2,5}$/i, '').trim()
  return splitNameAndSinger(noExt, singer).name.trim() || noExt
}

/** 看起来像文件名（带扩展名或「歌名 - 歌手」）才顺手修正曲库歌名 */
const looksLikeFileName = (name: string) => /\.[a-z0-9]{2,5}$/i.test(name) || /\s[-–—]\s/.test(name)

/** 批量写文件限并发：6 路网络并发，但磁盘同时只允许 2 个写入，避免 I/O 抖动 */
let activeWrites = 0
const writeWaiters: Array<() => void> = []
const withWriteSlot = async<T>(task: () => Promise<T>): Promise<T> => {
  if (activeWrites >= 2) await new Promise<void>(resolve => { writeWaiters.push(resolve) })
  activeWrites++
  try {
    return await task()
  } finally {
    activeWrites--
    writeWaiters.shift()?.()
  }
}

/** 读文件现有标签（仅真实路径 FLAC）；读不到返回 null，表示无法判断 */
const readExistingTags = async(item: LX.Music.MusicInfoLocal): Promise<Record<string, string> | null> => {
  if ((item.meta.ext ?? '').toLowerCase() !== 'flac') return null
  const path = item.meta.filePath
  if (!path || path.startsWith('content://')) return null
  try {
    return await readFlacTags(path)
  } catch {
    return null
  }
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
): Promise<TagScrapeItemStatus> => {
  const { item } = entry
  const match = await scrapeLocalMusic(item)
  if (!match) {
    summary.notFound++
    return 'notFound'
  }

  // 只补标签，封面写文件交给上面的「封面修复」：刮削批量大，少一次整文件重写快很多。
  // 但封面缺失时可以顺手把网络封面记进曲库，列表马上就能看到图。
  const needCover = !!match.picUrl && !await hasUsableCover(item)

  const targets = await resolveWriteTargets(item)
  const nextYear = [match.year, item.meta.year].find(Boolean) ?? ''
  const nextGenre = [match.genre, item.meta.genre].find(Boolean) ?? ''
  const nextLanguage = [match.language, item.meta.language].find(Boolean) ?? ''
  const result = await withWriteSlot(async() => writeTagsToFile(targets, {
    name: cleanTitle(item.name, item.singer) || match.name,
    singer: match.singer,
    albumName: match.albumName,
    year: nextYear,
    genre: nextGenre,
    language: nextLanguage,
  }))

  // 标签一定要同步进曲库（文件写失败也要更新，否则列表看起来「没反应」）
  const fixedName = cleanTitle(item.name, item.singer)
  await updateLocalMusicMeta(item, {
    name: looksLikeFileName(item.name) ? fixedName : match.name,
    singer: match.singer,
    albumName: match.albumName,
    year: nextYear || undefined,
    genre: nextGenre || undefined,
    language: nextLanguage || undefined,
    contentUri: result.contentUri ?? undefined,
  })
  if (result.target) summary.file++
  else summary.libraryOnly++

  if (needCover) {
    await updateLocalMusicPic(item.meta.filePath, match.picUrl)
    summary.cover++
  }
  return result.target ? 'file' : 'libraryOnly'
}

/**
 * 批量补全「语言 / 年份 / 风格」：联网匹配后只写这三类标签，
 * 不覆盖歌名/歌手/专辑；文件写失败也写回曲库。
 */
export const runMetaScrape = async(
  items: LX.Music.MusicInfoLocal[],
  callbacks: TagScrapeCallbacks,
): Promise<{ done: number, notFound: number, file: number, libraryOnly: number, skipped: number, stopped: boolean }> => {
  const total = items.length
  let done = 0
  let file = 0
  let libraryOnly = 0
  let notFound = 0
  let skipped = 0
  let stopped = false
  callbacks.onProgress({ done: 0, total })

  // 4 路并发：每首都要联网搜索+拉歌词，串行 240 首太慢
  let cursor = 0
  const runOne = async(item: LX.Music.MusicInfoLocal) => {
    try {
      const fixedName = cleanTitle(item.name, item.singer)
      const cleanedItem = looksLikeFileName(item.name) ? { ...item, name: fixedName } : item
      const match = await scrapeLocalMusic(cleanedItem)
      // 非中文歌用 MusicBrainz（Lyrico musicbrainz 插件同源）补风格/年份/封面
      const mb = match && !match.genre && isMusicBrainzCandidate(`${match.name} ${match.singer}`)
        ? await searchMusicBrainz(match.name, match.singer)
        : null
      if (!match) {
        notFound++
        callbacks.onItemResult?.(item, 'notFound')
      } else {
        const year = [match.year, mb?.year, item.meta.year].find(Boolean) ?? ''
        const genre = [match.genre, mb?.genre, item.meta.genre].find(Boolean) ?? ''
        const language = match.language ?? item.meta.language ?? ''
        const fixedName = cleanTitle(item.name, item.singer)
        const wanted = {
          title: looksLikeFileName(item.name) ? fixedName : item.name,
          artist: item.singer,
          album: item.meta.albumName ?? '',
          year,
          genre,
          language,
        }
        // 文件 + 曲库都已经是目标值 → 不再整文件重写（避免 mtime/MediaStore 抖动）
        const existingTags = await readExistingTags(item)
        const libUpToDate = sameText(item.name, wanted.title) &&
          sameText(item.singer, wanted.artist) &&
          sameText(item.meta.albumName, wanted.album) &&
          sameText(item.meta.year, wanted.year) &&
          sameText(item.meta.genre, wanted.genre) &&
          sameText(item.meta.language, wanted.language)
        if (libUpToDate && tagsMatch(existingTags, wanted)) {
          skipped++
          callbacks.onItemResult?.(item, 'file')
          callbacks.onProgress({ done: done + notFound, total })
          return
        }
        const targets = await resolveWriteTargets(item)
        const wrote = await withWriteSlot(async() => writeTagsToFile(targets, {
          // 曲库歌名如果已经是文件名，顺手写回干净歌名
          name: wanted.title,
          singer: wanted.artist,
          albumName: wanted.album,
          year: wanted.year,
          genre: wanted.genre,
          language: wanted.language,
        }))
        if (!item.meta.picUrl && mb?.coverUrl) {
          await updateLocalMusicPic(item.meta.filePath, mb.coverUrl).catch(() => {})
        }
        if (wrote.target) file++
        else libraryOnly++
        await updateLocalMusicMeta(item, {
          ...(looksLikeFileName(item.name) ? { name: fixedName } : null),
          year: year.length ? year : undefined,
          genre: genre.length ? genre : undefined,
          language: language.length ? language : undefined,
          contentUri: wrote.contentUri ?? undefined,
        })
        done++
        callbacks.onItemResult?.(item, wrote.target ? 'file' : 'libraryOnly')
      }
    } catch (error) {
      log.warn(`[tagScrape] ${item.name}: ${(error as Error)?.message ?? String(error)}`)
      notFound++
      callbacks.onItemResult?.(item, 'notFound')
    }
    callbacks.onProgress({ done: done + notFound, total })
  }

  const worker = async() => {
    while (true) {
      if (callbacks.shouldStop() || !callbacks.isAlive()) { stopped = true; return }
      const index = cursor++
      if (index >= total) return
      await runOne(items[index])
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()])
  return { done, notFound, file, libraryOnly, skipped, stopped }
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
      const status = await scrapeOne(items[i], summary)
      callbacks.onItemResult?.(items[i].item, status)
    } catch {
      // 单首失败（文件被占用 / 写入报错）不影响后面的歌
      summary.notFound++
      callbacks.onItemResult?.(items[i].item, 'notFound')
    }
    callbacks.onProgress({ done: i + 1, total })
  }

  return summary
}
