import { useEffect, useState } from 'react'
import Lyric, { type Lines } from 'lrc-file-parser'
// import { getStore, subscribe } from '@/store'
export type Line = Lines[number]
type PlayHook = (line: number, text: string) => void
type SetLyricHook = (lines: Lines) => void

const createTimeLabelExp = () => /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

/**
 * 把一条 LRC 行的所有时间标签解析成毫秒。
 * 兼容 [mm:ss]、[mm:ss.xx]、[mm:ss.xxx]，也兼容一行多个时间标签（重复段）。
 */
const parseLineTimes = (rawLine: string) => {
  const labelExp = createTimeLabelExp()
  const labels: string[] = []
  const times: number[] = []
  let match: RegExpExecArray | null
  while ((match = labelExp.exec(rawLine))) {
    const minute = parseInt(match[1])
    const second = parseInt(match[2])
    const fraction = match[3]
    let ms = 0
    if (fraction) {
      ms = fraction.length === 1 ? parseInt(fraction) * 100 : fraction.length === 2 ? parseInt(fraction) * 10 : parseInt(fraction.slice(0, 3))
    }
    labels.push(match[0])
    times.push(minute * 60_000 + second * 1000 + ms)
  }
  if (!labels.length) return null
  return {
    labels,
    times,
    text: rawLine.replace(createTimeLabelExp(), '').trim(),
  }
}

/**
 * 把扩展歌词（翻译 / 罗马音 / 粤拼）的时间轴对齐到主歌词。
 *
 * lrc-file-parser 只用「时间标签字符串完全相同」来把扩展行挂到主歌词行上。
 * 但不同音源的翻译时间标签精度经常不一致（例如咪咕主歌词是 [mm:ss.SSS]，
 * 翻译是 [mm:ss.SS]；有的源还会差几毫秒），结果整段翻译一行都挂不上，
 * 用户看到的就是「外文歌词下面没有中文翻译」。
 *
 * 这里先按毫秒把扩展行匹配到主歌词行（完全相等优先，其次找最近的时间，容差 250ms），
 * 再用主歌词自己的时间标签重建扩展歌词，保证 parser 一定能关联上。
 */
export const alignExtendedLyric = (mainLyric: string, extendedLyric: string): string => {
  if (!mainLyric || !extendedLyric) return extendedLyric
  const mainLines: Array<{ label: string, time: number }> = []
  for (const rawLine of mainLyric.split(/\r\n|\n|\r/)) {
    const parsed = parseLineTimes(rawLine)
    if (!parsed) continue
    for (let i = 0; i < parsed.times.length; i++) mainLines.push({ label: parsed.labels[i], time: parsed.times[i] })
  }
  if (!mainLines.length) return extendedLyric
  mainLines.sort((a, b) => a.time - b.time)

  const labelAt = new Map<number, string>()
  for (const item of mainLines) {
    if (!labelAt.has(item.time)) labelAt.set(item.time, item.label)
  }

  const textAt = new Map<number, string>()
  let matched = 0
  for (const rawLine of extendedLyric.split(/\r\n|\n|\r/)) {
    const parsed = parseLineTimes(rawLine)
    if (!parsed?.text) continue
    for (const time of parsed.times) {
      let targetTime = labelAt.has(time) ? time : -1
      if (targetTime === -1) {
        // 不同源取整 / 微小偏移：找最近的主歌词行，容差 250ms（误差再大就不硬挂，宁可不显示也不挂错句）
        let bestDiff = 251
        for (const item of mainLines) {
          const diff = Math.abs(item.time - time)
          if (diff < bestDiff) {
            bestDiff = diff
            targetTime = item.time
          }
        }
      }
      // 一行翻译只挂一次，避免同一句重复
      if (targetTime < 0 || textAt.has(targetTime)) continue
      textAt.set(targetTime, parsed.text)
      matched++
    }
  }
  if (!matched) return extendedLyric

  const out: string[] = []
  for (const item of mainLines) {
    const text = textAt.get(item.time)
    if (text) out.push(`${item.label}${text}`)
  }
  return out.length ? out.join('\n') : extendedLyric
}

const lrcTools = {
  isInited: false,
  lrc: null as Lyric | null,
  currentLineData: { line: 0, text: '' },
  currentLines: [] as Lines,
  playHooks: [] as PlayHook[],
  setLyricHooks: [] as SetLyricHook[],
  isPlay: false,
  isShowTranslation: false,
  isShowRoma: false,
  lyricText: '',
  translationText: '' as string | null | undefined,
  romaText: '' as string | null | undefined,
  init() {
    if (this.isInited) return
    this.isInited = true
    this.lrc = new Lyric({
      onPlay: this.onPlay.bind(this),
      onSetLyric: this.onSetLyric.bind(this),
      offset: 100, // offset time(ms), default is 150 ms
    })
  },
  onPlay(line: number, text: string) {
    this.currentLineData.line = line
    // console.log(line)
    this.currentLineData.text = text
    for (const hook of this.playHooks) hook(line, text)
  },
  onSetLyric(lines: Lines) {
    this.currentLines = lines
    this.currentLineData.line = 0
    this.currentLineData.text = ''
    for (const hook of this.playHooks) hook(-1, '')
    for (const hook of this.setLyricHooks) hook(lines)
  },
  addPlayHook(hook: PlayHook) {
    this.playHooks.push(hook)
    hook(this.currentLineData.line, this.currentLineData.text)
  },
  removePlayHook(hook: PlayHook) {
    this.playHooks.splice(this.playHooks.indexOf(hook), 1)
  },
  addSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.push(hook)
    hook(this.currentLines)
  },
  removeSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.splice(this.setLyricHooks.indexOf(hook), 1)
  },
  setLyric() {
    const extendedLyrics = [] as string[]
    if (this.isShowTranslation && this.translationText) extendedLyrics.push(alignExtendedLyric(this.lyricText, this.translationText))
    // 注音/粤拼自动显示：有 romalrc 就展示，不再要求用户先去设置里手动打开
    if (this.romaText) extendedLyrics.push(alignExtendedLyric(this.lyricText, this.romaText))
    this.lrc!.setLyric(this.lyricText, extendedLyrics)
  },
}


export const init = async() => {
  lrcTools.init()
}

export const setLyric = (lyric: string, translation?: string, romalrc?: string) => {
  lrcTools.isPlay = false
  lrcTools.lyricText = lyric
  lrcTools.translationText = translation
  lrcTools.romaText = romalrc
  lrcTools.setLyric()
}
export const setPlaybackRate = (playbackRate: number) => {
  lrcTools.lrc!.setPlaybackRate(playbackRate)
}
export const toggleTranslation = (isShow: boolean) => {
  lrcTools.isShowTranslation = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const toggleRoma = (isShow: boolean) => {
  lrcTools.isShowRoma = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const play = (time: number) => {
  // console.log(time)
  lrcTools.isPlay = true
  lrcTools.lrc!.play(time)
}
export const pause = () => {
  // console.log('pause')
  lrcTools.isPlay = false
  lrcTools.lrc!.pause()
}

// on lyric play hook
export const useLrcPlay = (autoUpdate = true) => {
  const [lrcInfo, setLrcInfo] = useState(lrcTools.currentLineData)
  useEffect(() => {
    if (!autoUpdate) return
    const setLrcCallback: SetLyricHook = () => {
      setLrcInfo({ line: 0, text: '' })
    }
    const playCallback: PlayHook = (line, text) => {
      setLrcInfo({ line, text })
    }
    lrcTools.addSetLyricHook(setLrcCallback)
    lrcTools.addPlayHook(playCallback)
    setLrcInfo(lrcTools.currentLineData)
    return () => {
      lrcTools.removeSetLyricHook(setLrcCallback)
      lrcTools.removePlayHook(playCallback)
    }
  }, [autoUpdate])

  return lrcInfo
}

// on lyric set hook
export const useLrcSet = () => {
  const [lines, setLines] = useState<Lines>(lrcTools.currentLines)
  useEffect(() => {
    const callback = (lines: Lines) => {
      setLines(lines)
    }
    lrcTools.addSetLyricHook(callback)
    return () => { lrcTools.removeSetLyricHook(callback) }
  }, [])

  return lines
}

