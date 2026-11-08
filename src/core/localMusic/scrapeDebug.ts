/** 最近一次刮削每首歌的请求/返回值（仅内存，供音乐工具诊断页查看） */
export interface ScrapeDebugEntry {
  at: number
  name: string
  singer: string
  source: string
  matchTitle: string
  matchSinger: string
  matchAlbum: string
  albumId: string
  songmid: string
  year: string
  genre: string
  language: string
  raw: string
  note: string
}

const MAX = 120
let entries: ScrapeDebugEntry[] = []

export const clearScrapeDebug = () => { entries = [] }

export const pushScrapeDebug = (entry: Omit<ScrapeDebugEntry, 'at'>) => {
  entries.push({ ...entry, at: Date.now() })
  if (entries.length > MAX) entries.splice(0, entries.length - MAX)
}

export const getScrapeDebug = (): ScrapeDebugEntry[] => [...entries]
