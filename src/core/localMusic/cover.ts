import { existsFile } from '@/utils/fs'
import { readPic } from '@/utils/localMediaMetadata'
import { readAudioMeta } from '@/utils/directoryPicker'
import musicSdk from '@/utils/musicSdk'
import { splitNameAndSinger } from '@/utils/songName'

/**
 * 本地歌曲封面的统一解析。
 *
 * 规则和用户预期一致：**先找文件里的封面，没有再去网上找**。
 *
 * 这里有两个历史坑：
 * 1. 播放器以前只走 `readPic(filePath)`，公共目录（用户自己添加的文件夹）里的
 *    文件按路径打不开，于是直接跳到联网搜索；搜不到就只剩占位块。
 *    现在补上「用 content:// 文档 uri 抽内嵌封面」这一步，公共目录也能拿到本地封面。
 * 2. 扫描时会把 MediaStore 的 `content://media/external/audio/albumart/<id>` 记进
 *    `meta.picUrl` —— 这个地址在**没有封面**的专辑上也会生成，图片加载必然失败。
 *    以前把它当成「有封面」，导致播放器/列表不联网兜底，音乐工具也统计成 0 首缺失。
 *    现在这类地址一律不算有效封面。
 */

/** 内嵌封面的内存缓存（'' = 确认没有，别重复开文件） */
const embeddedCache = new Map<string, string>()
/** 网络封面的内存缓存 */
const networkCache = new Map<string, string>()

/** MediaStore 的 albumart 地址（无封面时也存在，但加载会失败，不能当封面用） */
const isAlbumArtUri = (url: string) => /^content:\/\/media\//i.test(url)

/** http(s) 地址（网络封面） */
const isRemoteUrl = (url: string) => /^https?:\/\//i.test(url)

/**
 * 封面地址是否还能用：
 * - http(s)：网络地址直接可用（真挂了由图片组件 onError 兜底）
 * - content://：只有 albumart 这类「占位地址」，一律视为无效
 * - 本地路径：文件必须真的存在（缓存文件被系统清掉就作废）
 */
export const isCoverUsable = async(url?: string | null): Promise<boolean> => {
  if (!url) return false
  if (isRemoteUrl(url)) return true
  if (isAlbumArtUri(url)) return false
  if (url.startsWith('content://')) return false
  let path = url
  if (path.startsWith('file://')) {
    try {
      path = decodeURIComponent(path.slice('file://'.length))
    } catch {
      path = path.slice('file://'.length)
    }
  }
  return existsFile(path).catch(() => false)
}

/**
 * 读文件里的内嵌封面。
 * - 应用私有目录 / 有「所有文件访问」权限：直接按路径读
 * - 公共目录：按路径读不了，用 SAF 的 content:// 文档 uri 抽
 * @returns 封面文件路径 / 链接（'' 表示没有）
 */
export const readEmbeddedCover = async(item: LX.Music.MusicInfoLocal): Promise<string> => {
  const key = item.meta.filePath
  if (!key) return ''
  const cached = embeddedCache.get(key)
  if (cached != null) return cached

  // 曲库里记着的「从文件抽出来的缓存封面」还活着就不用再开一次音频文件；
  // albumart 地址不可信，不走这个快捷路径。
  const stored = item.meta.picUrl
  if (stored && !isRemoteUrl(stored) && !isAlbumArtUri(stored) && await isCoverUsable(stored)) {
    embeddedCache.set(key, stored)
    return stored
  }

  let pic = ''
  try {
    pic = await readPic(key)
  } catch {}
  if (!pic) {
    // SAF 文档 uri 是公共目录唯一能稳定打开的方式（Android 10+ 路径可能 EACCES）
    const contentUri = item.meta.contentUri
    if (contentUri) {
      try {
        pic = (await readAudioMeta(contentUri))?.cover ?? ''
      } catch {}
    }
  }
  if (pic && !await isCoverUsable(pic)) pic = ''
  embeddedCache.set(key, pic)
  return pic
}

/** 清掉某个文件的内嵌封面缓存（写完封面后要重新抽） */
export const invalidateEmbeddedCover = (filePath: string) => {
  embeddedCache.delete(filePath)
}

/** 歌名归一化：比较搜索结果时忽略空格、括号、连字符这类噪音 */
const normalize = (text?: string | null) => (text ?? '')
  .toLowerCase()
  .replace(/[\s\-–—_·・()（）[\]【】、,，/&]/g, '')

/** 歌手字段可能是「A/B」「A、B」「A & B」「A feat. B」，拆开逐个比对 */
const splitSingers = (singer?: string | null) => (singer ?? '')
  .split(/[/、,&]|\sfeat\.?\s|\sft\.?\s/i)
  .map(text => normalize(text))
  .filter(Boolean)

/** 依次尝试的音源（酷我命中率最高，其次是 QQ、网易） */
const COVER_SOURCES = ['kw', 'tx', 'wy'] as const

interface SearchResultLike {
  name?: string
  singer?: string
  source?: string
  songmid?: string
  albumId?: string
  /** 各音源搜索结果里的封面字段（tx / wy 直接给，kw 为空） */
  img?: string | null
  meta?: { picUrl?: string | null }
}

interface MusicSdkSource {
  musicSearch?: { search: (keyword: string, page: number, limit: number) => Promise<{ list?: SearchResultLike[] } | null> }
  getPic?: (musicInfo: SearchResultLike) => Promise<string | null | undefined> | string | null | undefined
}

/** 单次搜索最多等 8 秒，音源接口偶尔会挂住，不能让批量修封面卡死 */
const withTimeout = async<T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
  return Promise.race([
    promise,
    new Promise<null>(resolve => { setTimeout(() => { resolve(null) }, ms) }),
  ])
}

/** 给候选结果打分：歌名必须能对上，再比歌手，避免「取第一条」配错歌 */
const scoreCandidate = (result: SearchResultLike, name: string, singer: string): number => {
  const resultName = normalize(result.name)
  const targetName = normalize(name)
  if (!resultName || !targetName) return -1

  let score = 0
  if (resultName === targetName) score += 4
  else if (resultName.includes(targetName) || targetName.includes(resultName)) score += 2
  // 歌名完全对不上就不要了，否则会把封面配到别的歌上
  else return -1

  const targetSingers = splitSingers(singer)
  if (targetSingers.length) {
    const resultSingers = splitSingers(result.singer)
    if (resultSingers.some(s => targetSingers.includes(s))) score += 3
    else if (resultSingers.some(s => targetSingers.some(t => s.includes(t) || t.includes(s)))) score += 2
    // 歌手对不上也保留候选（合唱 / 翻唱 / 歌手名写法不同很常见），但排序靠后
    else score -= 1
  }
  return score
}

/** 从搜索结果里拿封面：优先自带 img，没有就按音源再请求一次 getPic */
const getResultPic = async(source: string, result: SearchResultLike): Promise<string> => {
  let url = result.img ?? result.meta?.picUrl ?? ''
  if (url && !isRemoteUrl(url)) url = ''
  if (url) return url

  const api = (musicSdk as unknown as Record<string, MusicSdkSource | undefined>)[source]
  if (!api?.getPic) return ''
  try {
    const pic = await withTimeout(Promise.resolve(api.getPic(result)), 8000)
    if (typeof pic === 'string' && isRemoteUrl(pic)) return pic
  } catch {}
  return ''
}

/**
 * 联网找封面：用「歌名 + 歌手」搜一次，挑最像的那条结果的封面地址。
 * 结果按文件路径缓存，同一首歌不会反复搜。
 */
export const fetchNetworkCover = async(item: LX.Music.MusicInfoLocal): Promise<string> => {
  const key = item.meta.filePath
  if (!key) return ''
  const cached = networkCache.get(key)
  if (cached) return cached

  const { name, singer } = splitNameAndSinger(item.name, item.singer)
  const keyword = `${name} ${singer}`.trim()
  if (!keyword) return ''

  for (const source of COVER_SOURCES) {
    const api = (musicSdk as unknown as Record<string, MusicSdkSource | undefined>)[source]
    if (!api?.musicSearch?.search) continue

    const res = await withTimeout(api.musicSearch.search(keyword, 1, 20), 8000).catch(() => null)
    const list = res?.list ?? []
    if (!list.length) continue

    const best = list
      .map(result => ({ result, score: scoreCandidate(result, name, singer) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    for (const { result } of best) {
      const url = await getResultPic(source, result)
      if (url) {
        networkCache.set(key, url)
        return url
      }
    }
  }

  // 只缓存成功结果：网络临时失败时不要记住「没有封面」，否则本次会话里再也不重试
  return ''
}

/** 只从网络缓存里取（不联网），列表渲染用，避免滚动时触发搜索 */
export const getCachedNetworkCover = (filePath: string) => networkCache.get(filePath) ?? ''

/**
 * 统一入口：本地封面优先，没有（且允许联网时）再取网络封面。
 * @returns 封面地址（'' 表示确实找不到）
 */
export const resolveLocalCover = async(
  item: LX.Music.MusicInfoLocal,
  options: { allowNetwork?: boolean } = {},
): Promise<string> => {
  const embedded = await readEmbeddedCover(item)
  if (embedded) return embedded

  // 曲库里存过的封面（上次联网找到的网络地址 / 扫描时抽出来的缓存文件）
  if (item.meta.picUrl && await isCoverUsable(item.meta.picUrl)) return item.meta.picUrl

  const cached = networkCache.get(item.meta.filePath)
  if (cached) return cached

  if (!options.allowNetwork) return ''
  return fetchNetworkCover(item)
}
