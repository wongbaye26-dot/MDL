import { getData, saveData } from '@/plugins/storage'
import { log } from '@/utils/log'

/**
 * 下载线程基准统计。
 *
 * 每次下载进度事件按「该任务实际使用的连接数」采样一次速度，
 * 累积出 1/2/3/4 线程的平均速度，用于设置页展示和自动选择最佳线程数。
 * 只存聚合值，不存 URL / 歌曲信息。
 */
const KEY = 'download_thread_stats_v1'
const MIN_SAMPLES = 5

export interface ThreadStat {
  threads: number
  samples: number
  /** 平均速度，bytes/s */
  avgSpeed: number
}

type Store = Record<string, ThreadStat>

let cache: Store | null = null
let loadPromise: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

const load = async() => {
  if (cache) return
  const data = await getData<Store>(KEY).catch(() => null)
  // eslint-disable-next-line require-atomic-updates
  cache = data && typeof data === 'object' ? data : {}
}

export const loadThreadStats = async(): Promise<void> => {
  if (!loadPromise) loadPromise = load().catch(err => { log.error(err) })
  await loadPromise
}

const scheduleSave = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (!cache) return
    void saveData(KEY, cache).catch(err => { log.error(err) })
  }, 2000)
}

/** 记录一次速度采样；同线程数做滑动平均 */
export const recordThreadSample = (threads: number, bytesPerSec: number) => {
  if (!cache || !Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return
  const key = String(Math.max(1, Math.min(4, Math.round(threads))))
  const prev = cache[key] ?? { threads: Number(key), samples: 0, avgSpeed: 0 }
  const samples = prev.samples + 1
  cache[key] = {
    threads: prev.threads,
    samples,
    avgSpeed: (prev.avgSpeed * prev.samples + bytesPerSec) / samples,
  }
  scheduleSave()
}

export const getThreadStats = (): ThreadStat[] => Object.values(cache ?? {}).sort((a, b) => a.threads - b.threads)

/** 样本足够时返回平均速度最高的线程数，否则返回 null（保持默认策略） */
export const getBestThreads = (): number | null => {
  const list = getThreadStats().filter(item => item.samples >= MIN_SAMPLES)
  if (!list.length) return null
  return list.reduce((best, item) => item.avgSpeed > best.avgSpeed ? item : best).threads
}

export const clearThreadStats = async() => {
  cache = {}
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  await saveData(KEY, cache).catch(err => { log.error(err) })
}
