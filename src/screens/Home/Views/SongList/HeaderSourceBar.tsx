import { memo, useEffect, useReducer } from 'react'
import { View } from 'react-native'

import { SourceChip } from '@/components/common/SourceLogo'
import { useSourceListI18n } from '@/components/SourceSelector'
import { createStyle } from '@/utils/tools'
import { getHeaderSources, subscribeHeaderSources } from './headerSources'

/**
 * 歌单广场页头标题右侧的来源图标组。
 *
 * 两个入口（独立页 SongListScreen / 首页 PageModal）的页头都渲染这个组件，
 * 和右侧的「打开歌单链接」等按钮同一水平线对齐；图标用现成的 SourceChip
 * （sm：34dp 触控区 / 18dp 单色品牌图标，选中=主题主色）。
 *
 * 原来单独一排的来源图标已从 Content 里删除，排序/分类 chips 行保留。
 */
export default memo(() => {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeHeaderSources(forceUpdate), [])

  const state = getHeaderSources()
  const sourceList = useSourceListI18n(state.sources)

  if (!state.visible) return null

  return (
    <View style={styles.row}>
      {
        sourceList.map(({ label, action }) => (
          <SourceChip
            key={action}
            source={action}
            label={label}
            size='sm'
            active={action === state.active}
            onPress={() => { if (action !== state.active) state.onChange(action as LX.OnlineSource) }}
          />
        ))
      }
    </View>
  )
})

const styles = createStyle({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
})
