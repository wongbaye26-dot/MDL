import { useSyncExternalStore } from 'react'
import { DeviceEventEmitter, NativeModules } from 'react-native'

import playerState from '@/store/player/state'

/**
 * 投屏（DLNA）状态与原生桥接。
 *
 * 原生侧负责 SSDP 搜索、UPnP 控制、本地媒体 HTTP 服务；
 * 这里只维护一份可订阅的快照，界面和播放器都读它。
 *
 * 注意：投屏时手机本地的 TrackPlayer 是暂停的，播放进度来自电视轮询，
 * 所以 `isCasting()` 为真时播放相关的 getPosition/getDuration 都要走这里的快照。
 */

export interface CastDevice {
  id: string
  name: string
  model: string
  location: string
}

export type CastTransport = 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'TRANSITIONING' | 'UNKNOWN'

export interface CastSnapshot {
  supported: boolean
  /** 搜索到的电视（一次搜索会增量补齐） */
  devices: CastDevice[]
  searching: boolean
  connected: boolean
  device: CastDevice | null
  transport: CastTransport
  /** 电视上报的播放进度（秒） */
  position: number
  /** 电视上报的曲目时长（秒） */
  duration: number
  /** 电视把这首放完了（只对一次切歌触发自动下一首） */
  ended: boolean
  error: string | null
}

interface DlnaNativeModule {
  startSearch: () => void
  stopSearch: () => void
  getDevices: () => Promise<CastDevice[]>
  connect: (id: string) => void
  disconnect: () => void
  cast: (url: string, title: string, artist: string, album: string, cover: string, duration: number) => void
  control: (action: string, value: number) => void
}

const native = NativeModules.DlnaModule as DlnaNativeModule | undefined

const EVENT_DEVICES = 'DlnaDevices'
const EVENT_SEARCH = 'DlnaSearchState'
const EVENT_CONNECTION = 'DlnaConnection'
const EVENT_STATE = 'DlnaState'
const EVENT_ERROR = 'DlnaError'

const initialSnapshot: CastSnapshot = {
  supported: !!native,
  devices: [],
  searching: false,
  connected: false,
  device: null,
  transport: 'UNKNOWN',
  position: 0,
  duration: 0,
  ended: false,
  error: null,
}

let snapshot: CastSnapshot = initialSnapshot
const listeners = new Set<() => void>()
let initialized = false

const emit = () => {
  listeners.forEach(listener => { listener() })
}

const patch = (next: Partial<CastSnapshot>) => {
  snapshot = { ...snapshot, ...next }
  emit()
}

/** 搜索到的电视列表（增量推送） */
const handleDevices = (devices: CastDevice[]) => {
  // 连接中的电视可能在后续搜索结果里换了个 name，保持连接对象同步
  const connectedDevice = snapshot.device
    ? devices.find(device => device.id === snapshot.device?.id) ?? snapshot.device
    : null
  patch({ devices, device: connectedDevice })
}

const handleConnection = (payload: { connected: boolean, device?: CastDevice }) => {
  patch({
    connected: payload.connected,
    device: payload.connected ? payload.device ?? null : null,
    transport: payload.connected ? snapshot.transport : 'UNKNOWN',
    position: 0,
    duration: 0,
    ended: false,
    error: null,
  })
}

// 断开投屏时用它把电视进度接回手机播放
let lastCastPosition = 0

const handleState = (payload: { transport?: CastTransport, position?: number, duration?: number, ended?: boolean }) => {
  if (typeof payload.position == 'number' && payload.position > 0) lastCastPosition = payload.position
  // 电视每次轮询都会报 STOPPED，只在「之前不是 STOPPED」时算一次播完
  const wasStopped = snapshot.transport === 'STOPPED'
  const transport = payload.transport ?? snapshot.transport
  const ended = !wasStopped && transport === 'STOPPED' && snapshot.transport === 'PLAYING'
  patch({
    transport,
    position: payload.position ?? snapshot.position,
    duration: payload.duration ?? snapshot.duration,
    ended,
  })
  // 电视把这首放完了：交给播放器走一次自动下一首（只在本轮 STOPPED 的第一次触发）
  if (ended) global.app_event.playerEnded()
}

const handleError = (payload: { message?: string }) => {
  patch({ error: payload.message ?? '投屏出错' })
}

const init = () => {
  if (initialized || !native) return
  initialized = true
  DeviceEventEmitter.addListener(EVENT_DEVICES, handleDevices)
  DeviceEventEmitter.addListener(EVENT_SEARCH, (payload: { searching?: boolean }) => {
    patch({ searching: !!payload?.searching })
  })
  DeviceEventEmitter.addListener(EVENT_CONNECTION, handleConnection)
  DeviceEventEmitter.addListener(EVENT_STATE, handleState)
  DeviceEventEmitter.addListener(EVENT_ERROR, handleError)
}

export const subscribeCast = (listener: () => void) => {
  init()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getCastSnapshot = () => snapshot

/** 播放器页用它订阅投屏状态 */
export const useCast = () => useSyncExternalStore(subscribeCast, getCastSnapshot)

// ───────────────────────── 对外操作 ─────────────────────────

export const isCastSupported = () => snapshot.supported

/** 当前是否正在投屏（连上了电视就算，哪怕电视暂停着） */
export const isCasting = () => snapshot.connected

export const castTransport = () => snapshot.transport
export const castPosition = () => snapshot.position
export const castDuration = () => snapshot.duration

export const startCastSearch = () => {
  if (!native) return
  init()
  patch({ searching: true, error: null })
  try {
    native.startSearch()
  } catch {
    patch({ searching: false })
  }
}

export const stopCastSearch = () => {
  if (!native) return
  try {
    native.stopSearch()
  } catch {}
}

export const connectCastDevice = (id: string) => {
  if (!native) return
  try {
    native.connect(id)
  } catch (error) {
    patch({ error: (error as Error)?.message ?? '连接失败' })
  }
}

export const disconnectCast = () => {
  if (!native) return
  lastCastPosition = snapshot.position
  try {
    native.disconnect()
  } catch {}
}

/** 断开投屏后，电视停在的播放进度（秒） */
export const castLastPosition = () => lastCastPosition

export interface CastMediaMeta {
  title: string
  artist: string
  album: string
  cover: string
  duration: number
}

/**
 * 把一首歌推给电视。
 *
 * @param url 已经解析好的可播放地址（本地路径 / content:// / http(s)）
 */
export const castMedia = (url: string, meta: CastMediaMeta) => {
  if (!native || !snapshot.connected) return
  try {
    native.cast(url, meta.title, meta.artist, meta.album, meta.cover, meta.duration)
    patch({ transport: 'PLAYING', position: 0, duration: meta.duration, ended: false, error: null })
  } catch (error) {
    patch({ error: (error as Error)?.message ?? '投屏失败' })
  }
}

export const castControl = (action: 'play' | 'pause' | 'stop' | 'seek' | 'volume', value = 0) => {
  if (!native || !snapshot.connected) return
  try {
    native.control(action, value)
  } catch {}
}

/** 当前歌曲的封面地址：只有 http(s) 才给电视（本地图片电视拉不到） */
export const castCoverUrl = () => {
  const pic = playerState.musicInfo.pic
  // 本地音乐的封面是 content:// 或 file://，电视访问不到，交给原生代理转一手
  return typeof pic == 'string' ? pic : ''
}
