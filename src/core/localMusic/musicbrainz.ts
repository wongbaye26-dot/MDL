/**
 * MusicBrainz 元数据源（对齐 Lyrico 的 musicbrainz 插件）：
 * - recording search 取发行年份 / release mbid / 封面；
 * - recording detail `inc=genres` 取风格；
 * - MusicBrainz 限速 1 请求/秒，这里做全局串行队列 + 内存缓存；
 * - 只建议给非中文歌补风格：中文歌 MB 覆盖率低，查了也大概率空。
 */

interface MbRecording {
  id?: string
  title?: string
  score?: number
  'first-release-date'?: string
  length?: number
  releases?: Array<{ id?: string, date?: string, title?: string }>
  'artist-credit'?: Array<{ name?: string }>
}

export interface MbMeta {
  year: string
  genre: string
  coverUrl: string
}

const BASE = 'https://musicbrainz.org/ws/2'
const UA = 'EmoMusic/3.24 (https://github.com/emo-music)'
const cache = new Map<string, MbMeta | null>()
let lastRequestAt = 0

const waitRate = async() => {
  const wait = 1100 - (Date.now() - lastRequestAt)
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
  // eslint-disable-next-line require-atomic-updates -- 限速队列有意串行更新
  lastRequestAt = Date.now()
}

const fetchJson = async<T>(url: string): Promise<T | null> => {
  await waitRate()
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 8000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: controller.signal })
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 歌名/歌手是否适合问 MusicBrainz：含大量 CJK 的歌直接跳过 */
export const isMusicBrainzCandidate = (text: string) => {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjk === 0
}

const formatYear = (raw?: string) => {
  const m = raw ? /(19|20)\d{2}/.exec(raw) : null
  return m ? m[0] : ''
}

/** 查询一首歌的年份/风格/封面；查不到返回 null（结果会缓存，避免重复请求） */
export const searchMusicBrainz = async(title: string, artist: string): Promise<MbMeta | null> => {
  const keyword = `${title} ${artist}`.trim()
  if (!keyword) return null
  const cached = cache.get(keyword)
  if (cached !== undefined) return cached

  const esc = (s: string) => s.replace(/"/g, '\\"')
  const query = artist
    ? `recording:"${esc(title)}" AND artist:"${esc(artist)}"`
    : `recording:"${esc(title)}"`
  const search = await fetchJson<{ recordings?: MbRecording[] }>(`${BASE}/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=8`)
  const scored = (search?.recordings ?? [])
    .filter(item => !!item.id)
    .map(item => {
      const disambiguation = String((item as { disambiguation?: string }).disambiguation ?? '').toLowerCase()
      const penalty = /live|remix|instrumental|karaoke|cover/.test(disambiguation) ? 30 : 0
      return { item, score: (item.score ?? 0) - penalty }
    })
    .sort((a, b) => b.score - a.score)
  const best = scored[0]?.item
  if (!best?.id) { cache.set(keyword, null); return null }

  const release = best.releases?.find(r => !!r.id) ?? best.releases?.[0]
  let genre = ''
  const detail = await fetchJson<{ genres?: Array<{ name?: string, count?: number }> }>(`${BASE}/recording/${best.id}?inc=genres&fmt=json`)
  if (detail?.genres?.length) {
    genre = [...detail.genres].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).map(g => g.name ?? '').filter(Boolean).slice(0, 3).join('/')
  }

  const meta: MbMeta = {
    // 用首次发行日期，避免取到现场版/重发版的日期
    year: formatYear(best['first-release-date']) || formatYear(release?.date),
    genre,
    coverUrl: release?.id ? `https://coverartarchive.org/release/${release.id}/front-500` : '',
  }
  cache.set(keyword, meta)
  return meta
}
