/**
 * 歌单广场页头「来源图标组」的模块级状态。
 *
 * 歌单广场有两个入口，页头都不在 `SongList` 组件内部：
 *  - 独立页（RNN 压栈）在 `SongListScreen` 的 PageHeader；
 *  - 首页大卡打开的是 `PageModal`，页头在 `Home/index.tsx`。
 * 而音源状态在 `SongList/Content.tsx` 内部，隔了几层 —— 用一份模块级状态桥接：
 * Content 写入，页头的 HeaderSourceBar 读取（和排行榜 headerSources 同一套做法）。
 */
type Sources = readonly LX.OnlineSource[]

interface HeaderSourcesState {
  /** 歌单广场挂载期间才显示（退出页面时清掉，避免图标残留到别的页头） */
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
