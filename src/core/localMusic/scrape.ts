import musicSdk from '@/utils/musicSdk'
import { splitNameAndSinger } from '@/utils/songName'
import { fetchNetworkCover } from './cover'
import { httpFetch } from '@/utils/request'
import { pushScrapeDebug } from './scrapeDebug'
import { detectLanguage } from '@/utils/language'

/**
 * 本地音乐标签刮削：拿「歌名 + 歌手」去各音源搜一遍，给每首歌挑一个真正对得上的结果。
 *
 * 为什么不用 `findMusic`：它内部会并行请求所有音源、还按 interval/album 做多轮排序，
 * 批量刮削（几十上百首）时请求量翻几倍，而且返回的是完整 MusicInfo 结构、字段形状随
 * 音源变化。这里只取写标签要用的几个字段，自己做归一化比对：
 *   1. 歌名必须能对上（完全一致优先，包含其次）；
 *   2. 本地有歌手时，歌手也必须对上，对不上就丢掉这条候选 —— 宁可少补，
 *      也不能把别人的歌手 / 专辑写进用户文件；
 *   3. 专辑、时长只是加分项，用于在多个候选里挑最优的，不参与「是否存在匹配」判断。
 */

/** 依次尝试的音源：酷我命中率最高，其次 QQ、网易 */
const SOURCES = ['kw', 'tx', 'wy'] as const
type ScrapeSource = typeof SOURCES[number]

interface SearchSong {
  name?: string | null
  singer?: string | null
  albumName?: string | null
  /** 音源返回的格式化时长，例：03:55 */
  interval?: string | null
  songmid?: string | number
  albumId?: string | number
  img?: string | null
  /** 部分音源（或搜索结果已被处理过时）把封面放在 meta.picUrl */
  meta?: { picUrl?: string | null }
  /** 部分音源会带发行年份 / 风格 */
  year?: string | number | null
  releaseDate?: string | null
  genre?: string | null
}

interface MusicSdkSourceLike {
  musicSearch?: {
    search: (keyword: string, page: number, limit: number) => Promise<{ list?: SearchSong[] } | null>
  }
  getPic?: (musicInfo: SearchSong) => Promise<string | null | undefined> | string | null | undefined
  getLyric?: (musicInfo: SearchSong) => Promise<{ lyric?: string | null } | string | null | undefined>
}

/** 刮削结果：只带写标签 / 找封面需要的字段 */
export interface ScrapeMatch {
  name: string
  singer: string
  albumName: string
  /** 网络封面地址（'' 表示这个音源没给封面，且联网搜索也没找到） */
  picUrl: string
  source: ScrapeSource
  songmid: string
  /** 0-100 的匹配度，UI 上用来展示「有多确定」 */
  score: number
  /** 发行年份（'' 表示音源没给） */
  year: string
  /** 风格（'' 表示音源没给） */
  genre: string
  /** 语言（从歌词/文字判断，'' 表示判断不出） */
  language: string
}

/** 一首「标签可补全」的歌：item + 缺什么 */
export interface TagIncompleteItem {
  item: LX.Music.MusicInfoLocal
  issues: string[]
}

/** 这些歌手写法等于「没有歌手」，比对时按空处理（MediaStore 会给 <unknown>） */
const PLACEHOLDER_SINGERS = new Set([
  '未知歌手', '未知', '未知艺术家', '群星', 'variousartists', 'various', 'va', '佚名',
  'unknown', 'unknownartist', 'noartist', 'undefined', 'null',
])

/** 这些专辑写法等于「没有专辑」 */
const PLACEHOLDER_ALBUMS = new Set([
  '未知专辑', '未知专辑名', '未知', 'unknown', 'unknownalbum', 'noalbum', 'undefined', 'null',
])

const isHttp = (url?: string | null): url is string => !!url && /^https?:\/\//i.test(url)

/** 歌名 / 歌手归一化：忽略大小写、空格、括号、尖括号、连字符这类噪音 */
const normalize = (text?: string | null) => (text ?? '')
  .toLowerCase()
  .replace(/[\s\-–—_·・()（）[\]【】<>、,，/&.。'"“”!！?？:：]/g, '')

/** 歌手字段可能是「A/B」「A、B」「A & B」「A feat. B」，拆开逐个比对 */
const splitSingers = (singer?: string | null) => (singer ?? '')
  .split(/[/、,&]|\sfeat\.?\s|\sft\.?\s/i)
  .map(text => normalize(text))
  .filter(Boolean)

const isPlaceholderSinger = (singer?: string | null) => {
  const normalized = normalize(singer)
  return !normalized || PLACEHOLDER_SINGERS.has(normalized)
}

const isPlaceholderAlbum = (album?: string | null) => {
  const normalized = normalize(album)
  return !normalized || PLACEHOLDER_ALBUMS.has(normalized)
}

/** '03:55' / '1:02:03' → 秒 */
const parseInterval = (value?: string | null) => {
  if (!value) return 0
  const parts = value.split(':').map(part => parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds
}

/** QQ 专辑详情里的发行日期/风格/语言（Lyrico QQ 插件同源字段） */
const getTxAlbumMeta = async(albumId: string): Promise<{ year: string, genre: string, language: string } | null> => {
  if (!albumId) return null
  try {
    const req = httpFetch(`https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg?albummid=${albumId}&format=json`, {
      headers: { Referer: 'https://y.qq.com/' },
    })
    const res = await withTimeout(req.promise, 4000, () => { req.cancelHttp() })
    if (!res) return null
    const data = (res.body as any)?.data
    const album = Array.isArray(data) ? data[0] : data
    if (!album) return null
    const rawYear = String(album.aDate ?? album.publishDate ?? '')
    const year = /(19|20)\d{2}/.exec(rawYear)?.[0] ?? ''
    const genre = String(album.genre ?? '').trim()
    const lan = String(album.lan ?? '').trim()
    const language = /粤语|粵語/.test(lan) ? '粤语'
      : /国语|國語/.test(lan) ? '普通话'
        : /英语|英語/i.test(lan) ? '英文'
          : /日语|日語/.test(lan) ? '日文'
            : /韩语|韓語/.test(lan) ? '韩文' : ''
    return { year, genre, language }
  } catch {
    return null
  }
}

/** QQ 专辑搜索：按「专辑名 + 歌手」拿到 albummid，再取 aDate/genre/lan */
const txAlbumCache = new Map<string, { year: string, genre: string, language: string } | null>()
const getTxAlbumMetaByName = async(albumName: string, singer: string) => {
  const key = `${albumName}\u0000${singer}`
  if (txAlbumCache.has(key)) return txAlbumCache.get(key) ?? null
  txAlbumCache.set(key, null)
  if (!albumName) return null
  try {
    const q = encodeURIComponent(`${albumName} ${singer}`.trim())
    const req = httpFetch(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${q}&format=json&n=1`, {
      headers: { Referer: 'https://y.qq.com/' },
    })
    const res = await withTimeout(req.promise, 4000, () => { req.cancelHttp() })
    const albummid = (res?.body as any)?.data?.song?.list?.[0]?.albummid
    if (!albummid) return null
    const meta = await getTxAlbumMeta(String(albummid))
    if (meta) txAlbumCache.set(key, meta)
    return meta
  } catch {
    return null
  }
}

/** 从搜索结果取年份 */
const getResultYear = (result: SearchSong): string => {
  const raw = String(result.year ?? result.releaseDate ?? '').trim()
  const match = /(19|20)\d{2}/.exec(raw)
  return match ? match[0] : ''
}

/** 从搜索结果取风格（部分音源没有该字段） */
const getResultGenre = (result: SearchSong): string => (result.genre ?? '').trim().slice(0, 60)

/** 拉取匹配结果的歌词文本，用于判断语言 */
const getResultLyric = async(source: ScrapeSource, result: SearchSong): Promise<string> => {
  const api = (musicSdk as unknown as Record<string, MusicSdkSourceLike | undefined>)[source]
  if (!api?.getLyric) return ''
  if (source === 'kw' && !result.songmid) return ''
  if (source === 'tx' && !result.songmid) return ''
  if (source === 'wy' && !result.songmid) return ''
  try {
    const res = await withTimeout(Promise.resolve(api.getLyric(result)), 2500)
    if (!res) return ''
    if (typeof res === 'string') return res
    return typeof res.lyric === 'string' ? res.lyric : ''
  } catch {
    return ''
  }
}

/** 一次搜索最多等 8 秒：音源接口偶尔挂住，不能让批量刮削卡死 */
const withTimeout = async<T,>(promise: Promise<T>, ms: number, cancel?: () => void): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<null>(resolve => {
        timer = setTimeout(() => {
          // 真正取消底层请求，避免停止任务后仍在消耗流量/占连接
          try { cancel?.() } catch {}
          resolve(null)
        }, ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

interface ScoredCandidate {
  result: SearchSong
  source: ScrapeSource
  score: number
}

/**
 * 给一条搜索结果打分。
 * @returns null 表示这条结果和本地歌名/歌手对不上，不能当匹配用
 */
const scoreCandidate = (
  result: SearchSong,
  targetNames: string[],
  targetSingers: string[],
  targetAlbum: string,
  targetInterval: number,
  source: ScrapeSource,
): ScoredCandidate | null => {
  const resultName = normalize(result.name)
  if (!resultName || !targetNames.length) return null

  // 本地歌名可能带「歌手 - 」前缀，所以要对多个候选名取最好的那个
  let nameScore = 0
  for (const targetName of targetNames) {
    if (resultName === targetName) {
      nameScore = 60
      break
    }
    if (targetName.length >= 2 && (resultName.includes(targetName) || targetName.includes(resultName))) {
      nameScore = Math.max(nameScore, 40)
    }
  }
  // 歌名对不上就丢掉：把封面/标签配到别的歌上比不补还糟
  if (!nameScore) return null

  let singerScore = 0
  if (!targetSingers.length) {
    singerScore = 15
  } else {
    const resultSingers = splitSingers(result.singer)
    if (resultSingers.some(singer => targetSingers.includes(singer))) singerScore = 25
    else if (resultSingers.some(singer => targetSingers.some(target => singer.includes(target) || target.includes(singer)))) singerScore = 20
    // 歌手对不上也丢掉：翻唱 / 同名歌 / 伴奏版本都靠歌手区分
    else return null
  }

  let albumScore = 0
  const resultAlbum = normalize(result.albumName)
  if (targetAlbum && resultAlbum) {
    if (resultAlbum === targetAlbum) albumScore = 10
    else if (resultAlbum.includes(targetAlbum) || targetAlbum.includes(resultAlbum)) albumScore = 5
  }

  let intervalScore = 0
  const resultInterval = parseInterval(result.interval)
  if (targetInterval && resultInterval) {
    const diff = Math.abs(targetInterval - resultInterval)
    if (diff <= 2) intervalScore = 10
    else if (diff <= 5) intervalScore = 5
  }

  // 音源优先级只用来打破平局：酷我的搜索结果通常最干净
  const sourceBonus = source === 'kw' ? 3 : source === 'tx' ? 2 : 1
  const score = nameScore + singerScore + albumScore + intervalScore + sourceBonus
  // 名字只是「包含」关系时要求歌手必须对上，避免搜到名字相近的其它歌
  if (nameScore === 40 && singerScore < 20) return null

  return { result, source, score }
}

const searchSource = async(source: ScrapeSource, keyword: string): Promise<SearchSong[]> => {
  const api = (musicSdk as unknown as Record<string, MusicSdkSourceLike | undefined>)[source]
  if (!api?.musicSearch?.search) return []
  try {
    const res = await withTimeout(api.musicSearch.search(keyword, 1, 10), 8000)
    return res?.list ?? []
  } catch {
    return []
  }
}

/** 从搜索结果里拿封面：优先自带 img，没有就按音源再请求一次 getPic */
const getResultPic = async(source: ScrapeSource, result: SearchSong): Promise<string> => {
  const img = result.img ?? result.meta?.picUrl
  if (isHttp(img)) return img

  const api = (musicSdk as unknown as Record<string, MusicSdkSourceLike | undefined>)[source]
  if (!api?.getPic) return ''
  // 关键字段为空时请求出来的会是「...M000undefined.jpg」这种死链，直接跳过
  if (source === 'kw' && !result.songmid) return ''
  if (source === 'tx' && !result.albumId) return ''
  if (source === 'wy' && !result.songmid) return ''
  try {
    const pic = await withTimeout(Promise.resolve(api.getPic(result)), 8000)
    return isHttp(pic) ? pic : ''
  } catch {
    return ''
  }
}

/**
 * 联网搜索一首本地歌曲的最佳匹配。
 * @returns null 表示没搜到「歌名 + 歌手」都对得上的结果
 */
export const scrapeLocalMusic = async(item: LX.Music.MusicInfoLocal): Promise<ScrapeMatch | null> => {
  const { name: rawName, singer: rawSinger } = splitNameAndSinger(item.name, item.singer)
  const name = (rawName ?? '').trim()
  const singer = (rawSinger ?? '').trim()
  const targetName = normalize(name)
  if (!targetName) return null

  const singerUnknown = isPlaceholderSinger(singer)
  const targetSingers = singerUnknown ? [] : splitSingers(singer)
  // 歌手未知时，歌名里可能还混着「歌手 - 」前缀（标签坏了 / 只读到文件名），
  // 把「- 」后面的部分也当作候选歌名，避免因为前缀对不上而漏掉匹配
  const targetNames = [targetName]
  if (singerUnknown) {
    const dashMatch = /^(.+?)\s*[-–—]\s*(.+)$/.exec(name)
    const tailName = normalize(dashMatch?.[2])
    if (tailName && !targetNames.includes(tailName)) targetNames.push(tailName)
  }
  const targetAlbum = normalize(item.meta.albumName)
  const targetInterval = parseInterval(item.interval)
  // 占位歌手（<unknown> / 未知歌手）不要带进搜索词，否则只会搜出一堆无关结果
  const keyword = `${name} ${singerUnknown ? '' : singer}`.trim()

  let best: ScoredCandidate | null = null
  for (const source of SOURCES) {
    const list = await searchSource(source, keyword)
    for (const result of list) {
      const candidate = scoreCandidate(result, targetNames, targetSingers, targetAlbum, targetInterval, source)
      if (!candidate) continue
      if (!best || candidate.score > best.score) best = candidate
    }
    // 已经有一首「歌名 + 歌手 + 专辑 + 时长」全对上的，没必要再请求后面的音源
    if (best && best.score >= 95) break
  }
  if (!best || best.score < 65) return null

  const matchedName = (best.result.name ?? '').trim()
  if (!matchedName) return null

  // 音源没给封面时，退回 cover.ts 的「联网找封面」（它内部还会再搜一次，但命中率更稳）
  const picUrl = await getResultPic(best.source, best.result) || await fetchNetworkCover(item)
  const lyric = await getResultLyric(best.source, best.result)
  // QQ 结果直接用 albumId；kw/wy 匹配时按专辑名反查 QQ 专辑，补年份/风格/lan
  let albumMeta = best.source === 'tx' && best.result.albumId
    ? await getTxAlbumMeta(String(best.result.albumId))
    : null
  if (!albumMeta && best.result.albumName) {
    albumMeta = await getTxAlbumMetaByName(String(best.result.albumName), String(best.result.singer ?? ''))
  }

  const matchedSinger = (best.result.singer ?? '').trim()
  const matchedAlbum = (best.result.albumName ?? '').trim()
  const finalYear = [getResultYear(best.result), albumMeta?.year].find(Boolean) ?? ''
  const finalGenre = [getResultGenre(best.result), albumMeta?.genre].find(Boolean) ?? ''
  const finalLanguage = [albumMeta?.language, detectLanguage(lyric, `${best.result.name ?? ''} ${best.result.singer ?? ''}`)].find(Boolean) ?? ''
  pushScrapeDebug({
    name: item.name,
    singer: item.singer,
    source: best.source,
    matchTitle: String(best.result.name ?? ''),
    matchSinger: String(best.result.singer ?? ''),
    matchAlbum: String(best.result.albumName ?? ''),
    albumId: String(best.result.albumId ?? ''),
    songmid: String(best.result.songmid ?? ''),
    year: finalYear,
    genre: finalGenre,
    language: finalLanguage,
    raw: JSON.stringify(best.result).slice(0, 1200),
    note: albumMeta ? 'QQ专辑: ' + JSON.stringify(albumMeta) : 'QQ专辑: 未命中',
  })
  return {
    name: matchedName,
    // 占位歌手 / 专辑不要写进文件（等于把「未知歌手」变成正式标签）
    singer: matchedSinger || (singerUnknown ? '' : singer),
    albumName: matchedAlbum || (isPlaceholderAlbum(item.meta.albumName) ? '' : (item.meta.albumName ?? '').trim()),
    picUrl,
    source: best.source,
    songmid: String(best.result.songmid ?? ''),
    score: Math.min(100, best.score),
    year: finalYear,
    genre: finalGenre,
    language: finalLanguage,
  }
}

/**
 * 判断一首歌的标签是不是「可补全」。
 *
 * 只挑确实能靠网络搜索补上的问题：
 * - 缺歌手 / 缺专辑 / 歌手是「未知」这类占位值；
 * - 歌名里混着歌手（下载文件命名是「歌手 - 歌名」，标题直接用了文件名）；
 * - 歌名就是文件名、且标签明显不全（扫描时读不到内嵌标签的典型表现）。
 */
export const getTagIssues = (item: LX.Music.MusicInfoLocal): string[] => {
  const issues: string[] = []
  const rawName = (item.name ?? '').trim()
  const singer = (item.singer ?? '').trim()
  const album = (item.meta.albumName ?? '').trim()

  const knownSinger = !isPlaceholderSinger(singer)
  if (!knownSinger) issues.push('缺歌手')
  if (isPlaceholderAlbum(album)) issues.push('缺专辑')

  // 已知歌手时看歌名里是否还带着「歌手 - 」；歌手缺失时按分隔符猜
  const { name: cleaned } = splitNameAndSinger(rawName, singer)
  if (cleaned !== rawName) issues.push('歌名含歌手')
  else if (!knownSinger && /^[^\-–—]{1,40}\s*[-–—]\s*\S/.test(rawName)) issues.push('歌名含歌手')

  if (issues.length) {
    // 标题等于文件名、其他标签又缺，基本可以确定文件里没写标签（扫描拿文件名兜的底）
    const baseName = (item.meta.filePath ?? '').split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
    if (baseName && rawName === baseName) issues.push('歌名来自文件名')
  }

  return issues
}

/** 扫一遍曲库，返回所有标签可补全的歌 */
export const scanTagIncomplete = (list: LX.Music.MusicInfoLocal[]): TagIncompleteItem[] => {
  const out: TagIncompleteItem[] = []
  for (const item of list) {
    const issues = getTagIssues(item)
    if (issues.length) out.push({ item, issues })
  }
  return out
}
