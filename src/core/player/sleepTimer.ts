import { useEffect, useState } from 'react'
import BackgroundTimer from 'react-native-background-timer'

import { pause } from '@/core/player/player'
import { setVolume } from '@/plugins/player'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'

/**
 * 定时关闭（Sleep Timer）。
 *
 * 3.8.8 把旧的「定时退出」整块删掉了，旧实现到点是 exitApp（杀进程），
 * 不符合「睡眠定时」的使用场景。这里重建为：
 * - 按时长（15/30/45/60/90 分钟）到点暂停；
 * - 或「播完当前曲」后暂停；
 * - 暂停前做 ~1.2s 音量淡出，避免突然静音；
 * - 用 BackgroundTimer 计时，退到后台仍生效；
 * - 暂停后恢复用户原音量。
 *
 * 不做「重启恢复」：定时关闭是一次性意图，重启后继续计时反而容易误伤。
 */

export type SleepTimerMode = 'duration' | 'endOfTrack'

export interface SleepTimerInfo {
  mode: SleepTimerMode | null
  /** 剩余秒数：时长模式是剩余时间，播完当前曲模式是当前曲剩余时间 */
  remaining: number
}

type Listener = (info: SleepTimerInfo) => void

const listeners = new Set<Listener>()
const FADE_STEPS = 12
const FADE_INTERVAL = 100

let mode: SleepTimerMode | null = null
let deadline = 0
let tickId: number | null = null
let fadeId: number | null = null
let volumeBackup = 1

const notify = () => {
  const info = getSleepTimerInfo()
  listeners.forEach(listener => { listener(info) })
}

const restoreVolume = () => {
  void setVolume(volumeBackup).catch(() => {})
}

const clearTick = () => {
  if (tickId) {
    BackgroundTimer.clearInterval(tickId)
    tickId = null
  }
}

/** 停表（不改变音量、不暂停） */
const stopTimer = () => {
  clearTick()
  mode = null
  deadline = 0
  notify()
}

const fadeOutAndPause = () => {
  if (fadeId) return
  volumeBackup = playerState.volume ?? settingState.setting['player.volume'] ?? 1
  let step = 0
  fadeId = BackgroundTimer.setInterval(() => {
    step++
    void setVolume(Math.max(0, volumeBackup * (1 - step / FADE_STEPS))).catch(() => {})
    if (step < FADE_STEPS) return
    if (fadeId) {
      BackgroundTimer.clearInterval(fadeId)
      fadeId = null
    }
    void pause().catch(() => {}).finally(() => {
      // 暂停完成后再恢复音量，避免淡出过程被下一次播放沿用
      setTimeout(restoreVolume, 200)
    })
  }, FADE_INTERVAL)
}

const tick = () => {
  if (!mode) return
  if (mode === 'duration') {
    if (deadline - Date.now() <= 0) {
      stopTimer()
      fadeOutAndPause()
    } else notify()
    return
  }
  // 播完当前曲：进度到末尾前 1.2s 暂停（避免下一首已经起播）
  const { maxPlayTime, nowPlayTime } = playerState.progress
  if (playerState.isPlay && maxPlayTime > 0 && nowPlayTime >= maxPlayTime - 1.2) {
    stopTimer()
    fadeOutAndPause()
    return
  }
  notify()
}

const ensureTick = () => {
  if (tickId) return
  tickId = BackgroundTimer.setInterval(tick, 1000)
}

export const getSleepTimerInfo = (): SleepTimerInfo => {
  if (mode === 'duration') {
    return { mode, remaining: Math.max(0, Math.round((deadline - Date.now()) / 1000)) }
  }
  if (mode === 'endOfTrack') {
    const { maxPlayTime, nowPlayTime } = playerState.progress
    return { mode, remaining: Math.max(0, Math.round((maxPlayTime || 0) - (nowPlayTime || 0))) }
  }
  return { mode: null, remaining: 0 }
}

/** 按分钟启动 */
export const startSleepTimer = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  clearTick()
  mode = 'duration'
  deadline = Date.now() + minutes * 60 * 1000
  ensureTick()
  notify()
}

/** 播完当前曲后暂停 */
export const startSleepTimerAtTrackEnd = () => {
  clearTick()
  mode = 'endOfTrack'
  deadline = 0
  ensureTick()
  notify()
}

export const cancelSleepTimer = () => {
  stopTimer()
  if (fadeId) {
    BackgroundTimer.clearInterval(fadeId)
    fadeId = null
    restoreVolume()
  }
}

export const useSleepTimerInfo = (): SleepTimerInfo => {
  const [info, setInfo] = useState<SleepTimerInfo>(getSleepTimerInfo)
  useEffect(() => {
    listeners.add(setInfo)
    setInfo(getSleepTimerInfo())
    return () => { listeners.delete(setInfo) }
  }, [])
  return info
}
