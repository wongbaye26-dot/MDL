import type { CueSheet, CueTrack } from './cue'

/**
 * CUE 分段 → 虚拟曲目（A2-09）。
 *
 * 一个整轨文件 + CUE 里的多段，生成多条「虚拟 track」：
 * - id: `cue:<audioId>:<trackNo>`；
 * - meta.cuePath / meta.cueTrack 记录来源；
 * - startMs/endMs 供播放器起播 seek 与「下一首」边界使用；
 * - 音频文件仍复用同一个本地文件，不复制、不转码。
 */

export interface CueVirtualTrack {
  id: string
  audioId: string
  trackNumber: number
  title: string
  performer: string
  startMs: number
  endMs?: number
  durationMs?: number
  interval: string
}

const formatMs = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const buildCueVirtualTracks = (sheet: CueSheet, audioId: string, audioDurationMs?: number): CueVirtualTrack[] => {
  return sheet.tracks.map((track: CueTrack) => {
    const endMs = track.endMs ?? audioDurationMs
    const durationMs = endMs != null ? Math.max(0, endMs - track.startMs) : track.durationMs
    return {
      id: `cue:${audioId}:${track.number}`,
      audioId,
      trackNumber: track.number,
      title: track.title || `Track ${String(track.number).padStart(2, '0')}`,
      performer: track.performer || sheet.performer,
      startMs: track.startMs,
      endMs,
      durationMs,
      interval: durationMs != null ? formatMs(durationMs) : '',
    }
  })
}

/** 虚拟 id 找回 audioId（播放时用于定位整轨文件） */
export const parseCueTrackId = (id: string): { audioId: string, trackNumber: number } | null => {
  const match = /^cue:(.+):(\d+)$/.exec(id)
  if (!match) return null
  return { audioId: match[1], trackNumber: Number(match[2]) }
}
