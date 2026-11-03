import { getData, saveData } from '@/plugins/storage'

/**
 * 首页「最近播放」的独立历史。
 *
 * 为什么不复用 `playerState.playedList`：
 * - 它只在「随机播放」模式下记录（默认是列表循环，所以首页一直是空的）；
 * - 切换播放列表 / 开启「自动清空已播放列表」时会被清空；
 * - 它的用途是随机模式防重复，不该被当成用户历史。
 *
 * 这里单独存一份，最多保留 20 首，去重、最新的在前，并持久化到本地。
 */

const STORAGE_KEY = 'recent_play_list'
const MAX_LENGTH = 20

let cache: LX.Music.MusicInfo[] | null = null
let loadPromise: Promise<LX.Music.MusicInfo[]> | null = null
/** 连续切歌时保存可能并发，串起来保证后写的不会被先写的覆盖 */
let saveQueue: Promise<void> = Promise.resolve()

const persist = async(list: LX.Music.MusicInfo[]): Promise<void> => {
  saveQueue = saveQueue
    .then(async() => { await saveData(STORAGE_KEY, list) })
    .catch(() => {})
  await saveQueue
}

const emit = (list: LX.Music.MusicInfo[]) => {
  global.state_event.recentPlayUpdated([...list])
}

/** 下载任务里包着歌曲信息，历史里只存歌曲本身 */
const unwrap = (music: LX.Music.MusicInfo | LX.Download.ListItem): LX.Music.MusicInfo => {
  return 'progress' in music ? music.metadata.musicInfo : music
}

const load = async(): Promise<LX.Music.MusicInfo[]> => {
  if (cache) return cache
  loadPromise ??= getData<LX.Music.MusicInfo[]>(STORAGE_KEY)
    .then(data => {
      const list = Array.isArray(data) ? data.filter(item => item?.id).slice(0, MAX_LENGTH) : []
      cache = list
      return list
    })
    .catch(() => {
      cache = []
      return []
    })
  return loadPromise
}

/** 读取历史（首页挂载时用） */
export const getRecentPlayList = async(): Promise<LX.Music.MusicInfo[]> => {
  const list = await load()
  return [...list]
}

/** 记一首最近播放：去重后插到最前面，超出 20 首丢弃最旧的 */
export const addRecentPlay = async(music: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const info = unwrap(music)
  if (!info?.id) return
  const list = await load()
  const next = [info, ...list.filter(item => item.id !== info.id)].slice(0, MAX_LENGTH)
  cache = next
  emit(next)
  await persist(next)
}

/** 清空历史（设置里以后要用的话） */
export const clearRecentPlay = async() => {
  cache = []
  emit(cache)
  await persist(cache)
}
