import { createContext, useContext, useEffect, useState } from 'react'

/**
 * 列表多选栏的「外置插槽」。
 *
 * 多选栏原本渲染在 `OnlineList` 内部（绝对定位在列表顶部），
 * 会盖住第一行；而整屏子页（排行榜/歌单广场）的标题右侧是空的。
 *
 * 这里用一份模块级状态把「是否多选、是否全选、模式、三个回调」暴露出去，
 * 由 `PageModal` 的标题右侧渲染一条精简版（`SelectionBarSlot`），
 * `MultipleModeBar` 检测到自己在带插槽的页面里就只写状态、不再自己画。
 */

export type SelectMode = 'single' | 'range'

interface SelectionBarState {
  visible: boolean
  isSelectAll: boolean
  selectMode: SelectMode
  onSelectAll?: () => void
  onExit?: () => void
  onSwitchMode?: (mode: SelectMode) => void
}

let state: SelectionBarState = {
  visible: false,
  isSelectAll: false,
  selectMode: 'single',
}

const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
}

export const getSelectionBar = () => state

export const subscribeSelectionBar = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** 多选状态变化时由 MultipleModeBar 调用 */
export const setSelectionBar = (next: Partial<SelectionBarState>) => {
  state = { ...state, ...next }
  emit()
}

export const resetSelectionBar = () => {
  if (!state.visible) return
  state = { ...state, visible: false }
  emit()
}

/**
 * 页面是否提供了「标题右侧插槽」。
 * MultipleModeBar 用它决定要不要自己渲染（歌单详情这种没有插槽的页面保持原样）。
 */
export const SelectionBarSlotContext = createContext(false)

export const useHasSelectionSlot = () => useContext(SelectionBarSlotContext)

/** 组件里读「当前是否处于多选」 */
export const useSelectionBarVisible = () => {
  const [visible, setVisible] = useState(state.visible)
  useEffect(() => subscribeSelectionBar(() => { setVisible(state.visible) }), [])
  return visible
}
