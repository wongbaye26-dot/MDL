import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'

/**
 * 隐藏歌曲 / 隐藏文件夹（W3 / D-11）。
 *
 * 只记录「不希望在本地音乐列表里看到」的 id 与文件夹，不删曲库、不动文件；
 * 恢复入口在 设置 → 音乐工具 → 隐藏内容，随时可以全部恢复。
 */

const HIDDEN_KEY = 'local_music_hidden_v1'

export interface HiddenState {
  ids: string[]
  folders: string[]
}

const emptyState = (): HiddenState => ({ ids: [], folders: [] })

let state: HiddenState = emptyState()
let loaded = false
const listeners = new Set<() => void>()

const notify = () => { for (const listener of listeners) listener() }

const persist = async() => { await saveData(HIDDEN_KEY, state).catch(() => {}) }

export const loadHidden = async(): Promise<HiddenState> => {
  if (loaded) return state
  try {
    const raw = await getData<Partial<HiddenState>>(HIDDEN_KEY)
    state = {
      ids: Array.isArray(raw?.ids) ? raw.ids : [],
      folders: Array.isArray(raw?.folders) ? raw.folders : [],
    }
  } catch {
    state = emptyState()
  }
  // eslint-disable-next-line require-atomic-updates -- 隐藏状态只在启动时加载一次
  loaded = true
  notify()
  return state
}

export const getHidden = (): HiddenState => state

export const subscribeHidden = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const update = (next: HiddenState) => {
  state = next
  loaded = true
  notify()
  void persist()
}

export const hideSong = async(id: string) => {
  await loadHidden()
  if (state.ids.includes(id)) return
  update({ ...state, ids: [...state.ids, id] })
}

export const unhideSong = async(id: string) => {
  await loadHidden()
  if (!state.ids.includes(id)) return
  update({ ...state, ids: state.ids.filter(item => item !== id) })
}

export const hideFolder = async(folder: string) => {
  await loadHidden()
  if (!folder || state.folders.includes(folder)) return
  update({ ...state, folders: [...state.folders, folder] })
}

export const unhideFolder = async(folder: string) => {
  await loadHidden()
  if (!state.folders.includes(folder)) return
  update({ ...state, folders: state.folders.filter(item => item !== folder) })
}

export const clearHidden = async() => {
  update(emptyState())
}

/** 文件是否被隐藏（自身 id 或所在文件夹被隐藏） */
export const isHiddenItem = (item: LX.Music.MusicInfoLocal, hidden: HiddenState = state) => {
  if (hidden.ids.includes(item.id)) return true
  const path = item.meta.filePath
  return hidden.folders.some(folder => path === folder || path.startsWith(`${folder}/`))
}

/** 组件里读隐藏状态（跨页面同步） */
export const useHidden = () => {
  const [hidden, setHidden] = useState<HiddenState>(state)
  useEffect(() => {
    let alive = true
    const update = () => { if (alive) setHidden({ ...state }) }
    listeners.add(update)
    void loadHidden().then(update)
    return () => {
      alive = false
      listeners.delete(update)
    }
  }, [])
  return hidden
}
