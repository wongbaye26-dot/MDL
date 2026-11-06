import { useEffect, useState } from 'react'

import { getData, saveData } from '@/plugins/storage'
import playerState from '@/store/player/state'

/**
 * 本地听歌统计。
 *
 * 与 `recentPlay`（只存最近 20 首、没有时间/次数）不同，这里记录可聚合的数据：
 * - 累计收听秒数、总播放次数（单曲连续听满 30s 才算一次）；
 * - 最近 30 天每天秒数（首页卡片画 7 日趋势）；
 * - 24 小时分布（留给后续「听歌时段」展示）；
 * - 艺人维度的秒数 Top 30。
 *
 * 埋点来自 `core/init/player/playProgress` 的 1s 进度轮询：
 * 只有「正在播放 + 正向小步进」才计入，seek 跳变（|Δ|>5s）直接丢弃，
 * 所以拖动进度条不会把统计刷爆。
 *
 * 持久化做 2s 防抖，避免每 1s 写一次 AsyncStorage。
 */

const STORAGE_KEY = 'listening_stats_v1'
const DAY_KEEP = 30
const ARTIST_KEEP = 30
const SONG_KEEP = 30
const COUNT_PLAY_AFTER_SECONDS = 30

interface StatsState {
  totalSeconds: number
  totalPlays: number
  days: Record<string, number>
  hours: number[]
  artists: Record<string, number>
  /** key = `${name}\u0001${singer}`，值是歌曲名/歌手/累计秒数（用于「常听歌曲」） */
  songs: Record<string, { name: string, singer: string, seconds: number }>
}

export interface ListeningStatsDay {
  key: string
  /** 周一/周二… */
  label: string
  seconds: number
}

export interface ListeningStats {
  totalSeconds: number
  totalPlays: number
  todaySeconds: number
  weekSeconds: number
  days: ListeningStatsDay[]
  topArtists: Array<{ name: string, seconds: number }>
  topSongs: Array<{ name: string, singer: string, seconds: number }>
  hours: number[]
}

const emptyState = (): StatsState => ({
  totalSeconds: 0,
  totalPlays: 0,
  days: {},
  hours: new Array(24).fill(0) as number[],
  artists: {},
  songs: {},
})

let state: StatsState = emptyState()
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastNotifyAt = 0

let lastTrackId = ''
let lastPosition = 0
let sessionSeconds = 0
let sessionCounted = false

const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const weekdayLabel = (date: Date) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]

const normalize = (raw: unknown): StatsState => {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<StatsState>
  return {
    totalSeconds: Number(input.totalSeconds) || 0,
    totalPlays: Number(input.totalPlays) || 0,
    days: input.days && typeof input.days === 'object' ? input.days : {},
    hours: Array.isArray(input.hours) && input.hours.length === 24
      ? input.hours.map(v => Number(v) || 0)
      : base.hours,
    artists: input.artists && typeof input.artists === 'object' ? input.artists : {},
    songs: input.songs && typeof input.songs === 'object' ? input.songs : {},
  }
}

const persist = async() => {
  try {
    await saveData(STORAGE_KEY, state)
  } catch {}
}

const scheduleSave = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void persist()
  }, 2000)
}

const notify = (force = false) => {
  const now = Date.now()
  if (!force && now - lastNotifyAt < 5000) return
  lastNotifyAt = now
  listeners.forEach(listener => { listener() })
}

const ensureLoaded = async(): Promise<void> => {
  if (loaded) return
  loading ??= getData<StatsState>(STORAGE_KEY)
    .then(raw => {
      state = normalize(raw)
      loaded = true
    })
    .catch(() => {
      state = emptyState()
      loaded = true
    })
    .finally(() => { loading = null })
  await loading
}

const trimArtists = () => {
  const entries = Object.entries(state.artists)
  if (entries.length <= ARTIST_KEEP) return
  entries.sort((a, b) => b[1] - a[1])
  state.artists = Object.fromEntries(entries.slice(0, ARTIST_KEEP))
}

const trimDays = () => {
  const keys = Object.keys(state.days).sort()
  if (keys.length <= DAY_KEEP) return
  const drop = keys.slice(0, keys.length - DAY_KEEP)
  for (const key of drop) delete state.days[key]
}

const trimSongs = () => {
  const entries = Object.entries(state.songs)
  if (entries.length <= SONG_KEEP) return
  entries.sort((a, b) => b[1].seconds - a[1].seconds)
  state.songs = Object.fromEntries(entries.slice(0, SONG_KEEP))
}

const addSeconds = (seconds: number, singer: string, songName: string) => {
  const now = new Date()
  const key = dateKey(now)
  state.totalSeconds += seconds
  state.days[key] = (state.days[key] ?? 0) + seconds
  state.hours[now.getHours()] = (state.hours[now.getHours()] ?? 0) + seconds
  const artist = (singer ?? '').trim()
  if (artist) state.artists[artist] = (state.artists[artist] ?? 0) + seconds
  const name = (songName ?? '').trim()
  if (name) {
    const songKey = `${name}\u0001${artist}`
    const prev = state.songs[songKey]
    state.songs[songKey] = { name, singer: artist, seconds: (prev?.seconds ?? 0) + seconds }
  }
}

/** 播放进度轮询回调：position 是当前播放秒数 */
export const recordPlaybackTick = (position: number) => {
  void ensureLoaded()
  const info = playerState.musicInfo
  if (!info?.id) return
  if (info.id !== lastTrackId) {
    lastTrackId = info.id
    lastPosition = position
    sessionSeconds = 0
    sessionCounted = false
    return
  }
  const delta = position - lastPosition
  lastPosition = position
  if (!playerState.isPlay || delta <= 0 || delta > 5) return

  addSeconds(delta, info.singer ?? '', info.name ?? '')
  sessionSeconds += delta
  if (!sessionCounted && sessionSeconds >= COUNT_PLAY_AFTER_SECONDS) {
    sessionCounted = true
    state.totalPlays += 1
    trimArtists()
    trimDays()
    trimSongs()
    notify(true)
  }
  scheduleSave()
  notify()
}

const buildSnapshot = (): ListeningStats => {
  const today = new Date()
  const days: ListeningStatsDay[] = []
  let weekSeconds = 0
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = dateKey(date)
    const seconds = Math.round(state.days[key] ?? 0)
    if (i < 7) weekSeconds += seconds
    days.push({ key, label: weekdayLabel(date), seconds })
  }
  const topArtists = Object.entries(state.artists)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, seconds]) => ({ name, seconds: Math.round(seconds) }))
  const topSongs = Object.values(state.songs)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)
    .map(song => ({ ...song, seconds: Math.round(song.seconds) }))
  return {
    totalSeconds: Math.round(state.totalSeconds),
    totalPlays: state.totalPlays,
    todaySeconds: Math.round(state.days[dateKey(today)] ?? 0),
    weekSeconds,
    days,
    topArtists,
    topSongs,
    hours: [...state.hours],
  }
}

export const getListeningStats = (): ListeningStats => buildSnapshot()

export const clearListeningStats = async() => {
  state = emptyState()
  lastTrackId = ''
  sessionSeconds = 0
  sessionCounted = false
  await persist()
  notify(true)
}

export const useListeningStats = (): ListeningStats => {
  const [snapshot, setSnapshot] = useState<ListeningStats>(() => buildSnapshot())

  useEffect(() => {
    let alive = true
    const update = () => { if (alive) setSnapshot(buildSnapshot()) }
    listeners.add(update)
    void ensureLoaded().then(update)
    // 跨天/长时间停留时刷新「今日」
    const timer = setInterval(update, 30000)
    return () => {
      alive = false
      listeners.delete(update)
      clearInterval(timer)
    }
  }, [])

  return snapshot
}
