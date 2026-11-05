/**
 * 排行榜页头「来源图标组」的模块级状态。
 *
 * 排行榜的页头在 `PageModal` 里（标题右侧插槽渲染的是 `CompactHero`），而来源状态
 * 在 `Leaderboard` 组件内部，中间隔着几层 —— 和 `utils/leaderboardHero` 同一套做法：
 * `Vertical/index.tsx` 写入、`CompactHero` 里的 `HeaderSourceBar` 读取。
 */
type Sources = readonly LX.OnlineSource[]

interface HeaderSourcesState {
  /** 排行榜挂载期间才显示（退出子页时清掉，避免图标残留到别的页头） */
  visible: boolean
  sources: Sources
  active: LX.OnlineSource
  onChange: (source: LX.OnlineSource) => void
}

let state: HeaderSourcesState = {
  visible: false,
  sources: [],
  active: 'kw',
  onChange: () => {},
}

const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) listener()
}

export const getHeaderSources = () => state

export const subscribeHeaderSources = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const setHeaderSources = (next: HeaderSourcesState) => {
  // 四个字段都没变就不触发重渲染
  if (
    next.visible === state.visible &&
    next.sources === state.sources &&
    next.active === state.active &&
    next.onChange === state.onChange
  ) return
  state = next
  emit()
}

export const resetHeaderSources = () => {
  if (!state.visible) return
  state = { ...state, visible: false }
  emit()
}
