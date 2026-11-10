import { memo, useEffect, useReducer } from 'react'

import { getSelectionBar, subscribeSelectionBar } from '@/utils/selectionBar'
import { getHeaderSources, subscribeHeaderSources } from './headerSources'
import SourceIconRow from '@/screens/Home/Views/SongList/SourceIconRow'

/**
 * 排行榜页头标题右侧的来源图标组（放在 CompactHero 里，和播放/下载按钮同一水平线）。
 *
 * 尺寸/间距统一由 `SourceIconRow` 负责（两处页头共用同一套数值，对齐收藏页页头）：
 * 圆形槽位 34dp、品牌字形光学约 15dp、间距 8dp、触控区 40dp；与播放按钮之间 8dp
 * （CompactHero 的按钮 marginLeft=8）。
 *
 * 多选时标题右侧还要放多选操作条（3 个 34dp 按钮），411dp 窄屏会挤爆标题行，
 * 所以多选期间这一组自动隐藏，退出多选恢复。
 */
export default memo(() => {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeHeaderSources(forceUpdate), [])
  useEffect(() => subscribeSelectionBar(forceUpdate), [])

  const state = getHeaderSources()

  if (!state.visible || getSelectionBar().visible) return null

  return (
    <SourceIconRow
      sources={state.sources}
      active={state.active}
      onChange={state.onChange}
    />
  )
})
