/**
 * CUE sheet 解析（A2-08）。
 *
 * 支持：FILE / TRACK / INDEX 01 / TITLE / PERFORMER / REM；
 * INDEX 帧格式 mm:ss:ff（75 帧/秒）。输出每段起始毫秒，结束由下一段推出。
 */

export interface CueTrack {
  number: number
  title: string
  performer: string
  startMs: number
  endMs?: number
  durationMs?: number
}

export interface CueSheet {
  file: string
  album: string
  performer: string
  tracks: CueTrack[]
}

const unquote = (text: string) => {
  const trimmed = text.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  return trimmed
}

const parseIndexMs = (value: string): number => {
  const match = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(value.trim())
  if (!match) return 0
  const [, mm, ss, ff] = match
  return (Number(mm) * 60 + Number(ss)) * 1000 + Math.round(Number(ff) * 1000 / 75)
}

export const parseCue = (text: string): CueSheet => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const sheet: CueSheet = { file: '', album: '', performer: '', tracks: [] }
  let current: CueTrack | null = null
  const indexed = new Set<CueTrack>()

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const [keywordRaw, ...restParts] = line.split(/\s+/)
    const keyword = keywordRaw.toUpperCase()
    const rest = restParts.join(' ')
    if (keyword === 'FILE') {
      sheet.file = unquote(rest.replace(/\s+WAVE\s*$/i, '').replace(/\s+BINARY\s*$/i, ''))
    } else if (keyword === 'TRACK') {
      const number = Number.parseInt(rest, 10)
      current = { number: Number.isNaN(number) ? sheet.tracks.length + 1 : number, title: '', performer: '', startMs: 0 }
      sheet.tracks.push(current)
    } else if (keyword === 'INDEX' && current) {
      const [indexNo, time] = rest.split(/\s+/)
      if (indexNo === '01' && time) {
        current.startMs = parseIndexMs(time)
        indexed.add(current)
      }
    } else if (keyword === 'TITLE' && current) {
      current.title = unquote(rest)
    } else if (keyword === 'TITLE') {
      sheet.album = unquote(rest)
    } else if (keyword === 'PERFORMER' && current) {
      current.performer = unquote(rest)
    } else if (keyword === 'PERFORMER') {
      sheet.performer = unquote(rest)
    }
  }

  // INDEX 缺失的段丢掉；按起始时间排序后计算时长
  const tracks = sheet.tracks.filter(track => indexed.has(track)).sort((a, b) => a.startMs - b.startMs)
  for (let i = 0; i < tracks.length; i++) {
    if (i + 1 < tracks.length) {
      tracks[i].endMs = tracks[i + 1].startMs
      tracks[i].durationMs = Math.max(0, tracks[i + 1].startMs - tracks[i].startMs)
    }
  }
  return { ...sheet, tracks }
}
