import { getData, saveData } from '@/plugins/storage'

/**
 * 本地音乐页的浏览偏好（排序 / 筛选），按页签记忆（W2 / D-05、D-06）。
 *
 * 存独立 key 而不塞进 setting：
 *  - 这是页面视图状态，不是全局功能开关，不需要参与设置搜索/同步；
 *  - 结构是嵌套对象（每个 tab 一套排序），setting 的扁平 key 不适合。
 */

export type LocalSortKey = 'name' | 'singer' | 'album' | 'duration' | 'added' | 'path'
export type LocalSortDir = 'asc' | 'desc'
export type LocalCoverFilter = 'all' | 'has' | 'none'

export interface LocalSortState {
  key: LocalSortKey
  dir: LocalSortDir
}

export interface LocalFilterState {
  /** 'all' 或扩展名（flac/mp3/…） */
  format: string
  cover: LocalCoverFilter
}

export interface LocalViewPrefs {
  sort: Record<string, LocalSortState>
  filter: LocalFilterState
}

const PREFS_KEY = 'local_music_view_prefs_v1'

export const defaultViewPrefs = (): LocalViewPrefs => ({
  sort: {
    song: { key: 'name', dir: 'asc' },
    recent: { key: 'added', dir: 'desc' },
    album: { key: 'name', dir: 'asc' },
    artist: { key: 'name', dir: 'asc' },
    folder: { key: 'path', dir: 'asc' },
  },
  filter: { format: 'all', cover: 'all' },
})

export const loadViewPrefs = async(): Promise<LocalViewPrefs> => {
  try {
    const raw = await getData<Partial<LocalViewPrefs>>(PREFS_KEY)
    const base = defaultViewPrefs()
    if (!raw) return base
    return {
      sort: { ...base.sort, ...(raw.sort ?? {}) },
      filter: { ...base.filter, ...(raw.filter ?? {}) },
    }
  } catch {
    return defaultViewPrefs()
  }
}

export const saveViewPrefs = async(prefs: LocalViewPrefs): Promise<void> => {
  try {
    await saveData(PREFS_KEY, prefs)
  } catch {}
}

export const SORT_OPTIONS: Array<{ key: LocalSortKey, label: string }> = [
  { key: 'name', label: '歌名' },
  { key: 'singer', label: '歌手' },
  { key: 'album', label: '专辑' },
  { key: 'duration', label: '时长' },
  { key: 'added', label: '添加时间' },
  { key: 'path', label: '文件路径' },
]

export const FORMAT_OPTIONS: Array<{ value: string, label: string }> = [
  { value: 'all', label: '全部格式' },
  { value: 'flac', label: 'FLAC' },
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A / AAC' },
  { value: 'wav', label: 'WAV' },
  { value: 'ogg', label: 'OGG / OPUS' },
  { value: 'ape', label: 'APE' },
]

export const COVER_OPTIONS: Array<{ value: LocalCoverFilter, label: string }> = [
  { value: 'all', label: '全部封面' },
  { value: 'has', label: '有封面' },
  { value: 'none', label: '无封面' },
]
