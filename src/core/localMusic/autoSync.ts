/* eslint-disable require-atomic-updates -- 后台同步的 running 标志只用于「同一时间别跑两次扫描」，允许宽松竞态 */
/**
 * 本地音乐库的「后台自动同步」。
 *
 * 两件事：
 *  1. 下载中心下完歌 → 直接入库（download 模块自己调 addLocalMusicFile），这里再兜一次扫描；
 *  2. 扫描目录里的文件被别的 App / 系统文件管理器增删改（MediaStore 变化）→ 收到原生
 *     ContentObserver 事件后做一次增量扫描，静默更新曲库。
 *
 * 全部在后台完成，不弹窗、不切页；同一时间只跑一次扫描，并做最小间隔节流。
 */
import { AppState, DeviceEventEmitter, NativeModules } from 'react-native'

import { getScanDirs, isScanning, scanLocalMusicSilently } from '@/core/localMusic'
import { log } from '@/utils/log'

interface MediaWatchNative {
  start?: () => void
  stop?: () => void
}

const MEDIA_CHANGED_EVENT = 'mediaStoreAudioChanged'
/** 两次自动扫描的最小间隔（用户连续拷歌时不必每首都扫） */
const MIN_INTERVAL_MS = 10_000
/** 有扫描在跑时的重试间隔 */
const RETRY_MS = 3_000

let started = false
let timer: ReturnType<typeof setTimeout> | null = null
let lastScanAt = 0
let running = false

const clearTimer = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

const runSync = async() => {
  clearTimer()
  if (running) return
  if (isScanning()) {
    timer = setTimeout(() => { void runSync() }, RETRY_MS)
    return
  }
  const since = Date.now() - lastScanAt
  if (since < MIN_INTERVAL_MS) {
    timer = setTimeout(() => { void runSync() }, MIN_INTERVAL_MS - since)
    return
  }
  running = true
  lastScanAt = Date.now()
  log.info('[localMusicAutoSync] start silent scan')
  try {
    const dirs = await getScanDirs()
    // 静默扫描：不在本地音乐页显示「扫描中」，只更新曲库
    await scanLocalMusicSilently(dirs)
  } catch (err) {
    // 后台同步失败不影响前台，下次事件再试
    log.warn('[localMusicAutoSync] silent scan failed', err)
  } finally {
    running = false
  }
}

/**
 * 请求一次后台同步（可传延迟做去抖）。
 *
 * 下载完成、收到 MediaStore 变化、App 回到前台都会走这里。
 */
export const requestLocalMusicSync = (delay = 1200) => {
  if (!started) return
  clearTimer()
  timer = setTimeout(() => { void runSync() }, delay)
}

/** App 启动时调用一次；重复调用无副作用 */
export const initLocalMusicAutoSync = () => {
  if (started) return
  started = true

  const mod = NativeModules.MediaWatchModule as MediaWatchNative | undefined
  try {
    mod?.start?.()
  } catch {}

  DeviceEventEmitter.addListener(MEDIA_CHANGED_EVENT, () => {
    requestLocalMusicSync(1200)
  })

  // 回到前台补一次：App 在后台时 MediaStore 的变化可能收不到广播
  AppState.addEventListener('change', state => {
    if (state === 'active') requestLocalMusicSync(1500)
  })
}
