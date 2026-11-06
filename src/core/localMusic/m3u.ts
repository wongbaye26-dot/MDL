import { cleanSongName } from '@/utils/songName'

/**
 * M3U / M3U8 导入导出（W5 / D-17）。
 *
 * 导出：标准 extended M3U（UTF-8），`#EXTINF:时长,歌手 - 歌名` + 绝对路径。
 * 导入：解析 `#EXTINF` 与下一行路径，按「路径精确 → 文件名 → 歌名+歌手+时长」
 * 三级匹配本地曲库；匹配不到的行单独计数，不阻断其它歌。
 */

export interface M3UEntry {
  path: string
  name?: string
  singer?: string
  duration?: number
}

export interface M3UMatchResult {
  matched: LX.Music.MusicInfoLocal[]
  unmatched: number
  entries: number
}

const secondsOfInterval = (interval?: string | null) => {
  if (!interval) return 0
  const parts = interval.split(':').map(part => Number.parseInt(part, 10))
  if (!parts.length || parts.some(Number.isNaN)) return 0
  let seconds = 0
  for (const part of parts) seconds = seconds * 60 + part
  return seconds
}

/** 生成 M3U8 文本 */
export const buildM3U8 = (list: LX.Music.MusicInfoLocal[]): string => {
  const lines = ['#EXTM3U']
  for (const item of list) {
    const duration = secondsOfInterval(item.interval)
    const title = [item.singer, cleanSongName(item.name, item.singer)].filter(Boolean).join(' - ')
    lines.push(`#EXTINF:${duration},${title}`)
    lines.push(item.meta.filePath)
  }
  return `${lines.join('\n')}\n`
}

/** 解析 M3U/M3U8 文本（兼容 BOM / CRLF / 相对路径） */
export const parseM3U = (text: string): M3UEntry[] => {
  const entries: M3UEntry[] = []
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  let pending: Omit<M3UEntry, 'path'> | null = null
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      if (!line.toUpperCase().startsWith('#EXTINF:')) continue
      const body = line.slice('#EXTINF:'.length)
      const comma = body.indexOf(',')
      const duration = Number.parseInt(comma < 0 ? body : body.slice(0, comma), 10)
      const title = comma < 0 ? '' : body.slice(comma + 1).trim()
      const singerParts = title.split(/\s+-\s+/)
      pending = {
        duration: Number.isNaN(duration) ? 0 : duration,
        singer: singerParts.length > 1 ? singerParts[0].trim() : '',
        name: singerParts.length > 1 ? singerParts.slice(1).join(' - ').trim() : title,
      }
      continue
    }
    // 非注释行：相对路径按 URI 规则解码一下
    let filePath = line
    try {
      if (!filePath.includes('://')) filePath = decodeURIComponent(filePath)
    } catch {}
    entries.push({ ...(pending ?? {}), path: filePath })
    pending = null
  }
  return entries
}

const normalizeText = (text?: string | null) => (text ?? '')
  .toLowerCase()
  .replace(/[\s\-–—_·・()（）[\]【】<>、,，/&.。'"“”!！?？:：]/g, '')

const baseName = (path: string) => path.replace(/\\/g, '/').split('/').pop() ?? path

/** 把解析结果匹配到本地曲库 */
export const matchM3UEntries = (entries: M3UEntry[], list: LX.Music.MusicInfoLocal[]): M3UMatchResult => {
  const byPath = new Map<string, LX.Music.MusicInfoLocal>()
  const byFileName = new Map<string, LX.Music.MusicInfoLocal>()
  const byNameSinger = new Map<string, LX.Music.MusicInfoLocal[]>()
  for (const item of list) {
    byPath.set(item.meta.filePath, item)
    byFileName.set(baseName(item.meta.filePath).toLowerCase(), item)
    const key = `${normalizeText(cleanSongName(item.name, item.singer))}|${normalizeText(item.singer)}`
    const group = byNameSinger.get(key)
    if (group) group.push(item)
    else byNameSinger.set(key, [item])
  }

  const matched: LX.Music.MusicInfoLocal[] = []
  const seen = new Set<string>()
  let unmatched = 0
  for (const entry of entries) {
    let item = byPath.get(entry.path)
    if (!item) item = byFileName.get(baseName(entry.path).toLowerCase())
    if (!item && entry.name) {
      const key = `${normalizeText(entry.name)}|${normalizeText(entry.singer)}`
      const candidates = byNameSinger.get(key)
      if (candidates?.length) {
        if (candidates.length === 1) item = candidates[0]
        else {
          const duration = entry.duration ?? 0
          item = candidates.find(candidate => {
            const diff = Math.abs(secondsOfInterval(candidate.interval) - duration)
            return duration > 0 && diff <= 2
          }) ?? candidates[0]
        }
      }
    }
    if (!item || seen.has(item.id)) { if (!item) unmatched += 1; continue }
    seen.add(item.id)
    matched.push(item)
  }
  return { matched, unmatched, entries: entries.length }
}
