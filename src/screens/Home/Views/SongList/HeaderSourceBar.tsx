import { memo, useEffect, useReducer } from 'react'

import { getHeaderSources, subscribeHeaderSources } from './headerSources'
import SourceIconRow from './SourceIconRow'

/**
 * 歌单广场页头标题右侧的来源图标组。
 *
 * 两个入口（独立页 SongListScreen / 首页 PageModal）的页头都渲染这个组件；
 * 尺寸/间距与排行榜共用 `SourceIconRow`（品牌字形光学约 20dp、触控区 38dp、
 * 字形间距约 10dp），与右侧圆形按钮之间固定 8dp（row 的 marginRight）。
 */
export default memo(() => {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeHeaderSources(forceUpdate), [])

  const state = getHeaderSources()

  if (!state.visible) return null

  return (
    <SourceIconRow
      sources={state.sources}
      active={state.active}
      onChange={state.onChange}
      // 与右侧「打开歌单链接」按钮之间统一 8dp
      style={{ marginRight: 8 }}
    />
  )
})
