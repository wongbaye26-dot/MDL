import { memo, useEffect, useReducer } from 'react'
import { View } from 'react-native'

import { SourceChip } from '@/components/common/SourceLogo'
import { useSourceListI18n } from '@/components/SourceSelector'
import { getSelectionBar, subscribeSelectionBar } from '@/utils/selectionBar'
import { createStyle } from '@/utils/tools'
import { getHeaderSources, subscribeHeaderSources } from './headerSources'

/**
 * 排行榜页头标题右侧的来源图标组（放在 CompactHero 里，和播放/下载按钮同一水平线）。
 *
 * 原来「酷我/酷狗/QQ/网易云/咪咕」是单独一排，用户要求移到标题右侧空白处。
 * 图标用现成的 SourceChip（sm：34dp 触控区 / 18dp 单色品牌图标），选中=主题主色。
 *
 * 多选时标题右侧还要放多选操作条（3 个 34dp 按钮），411dp 窄屏会挤爆标题行，
 * 所以多选期间这一组自动隐藏，退出多选恢复。
 */
export default memo(() => {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeHeaderSources(forceUpdate), [])
  useEffect(() => subscribeSelectionBar(forceUpdate), [])

  const state = getHeaderSources()
  const sourceList = useSourceListI18n(state.sources)

  if (!state.visible || getSelectionBar().visible) return null

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
