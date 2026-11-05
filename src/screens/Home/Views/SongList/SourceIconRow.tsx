import { memo } from 'react'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import SourceLogo, { isKnownSource } from '@/components/common/SourceLogo'
import { useSourceListI18n } from '@/components/SourceSelector'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

/**
 * 页头标题右侧的「来源品牌图标组」（排行榜 / 歌单广场共用，保证两处尺寸与间距一致）。
 *
 * 尺寸（v3.8.5 统一后）：
 *  - 品牌字形光学尺寸约 20dp：SourceLogo 的路径只占 48 视框的 36 单位（75%），
 *    所以传 size=27 → 实际字形 27×0.75 ≈ **20.25dp**；
 *  - 触控区：布局 30dp 方形 + hitSlop 4 → 有效触控 **38dp**（满足 36~38dp）；
 *  - 图标之间：30dp 布局紧挨 + 字形内缩 5dp → 字形视觉间距约 **9.75dp**（8~10dp）；
 *  - 与右侧圆形按钮组：由调用方给 8dp 间距（CompactHero 按钮 marginLeft=8 /
 *    歌单广场 HeaderSourceBar marginRight=8）。
 *
 * 颜色：当前音源=主题主色，其余 c-450（onSurfaceVariant 档）；按压 0.5 透明度反馈；
 * 无障碍标签沿用原「小X音乐」文字；未识别自定义音源回退文字按钮。
 */
export const HEADER_SOURCE_ICON_SIZE = 27
/** 每个来源按钮的布局尺寸（配合 hitSlop 4 → 38dp 触控区） */
const ITEM_SIZE = 30
/** hitSlop：布局 30 + 4×2 = 38dp 触控区 */
const ITEM_HIT_SLOP = 4

export interface SourceIconRowProps {
  sources: readonly LX.OnlineSource[]
  active: LX.OnlineSource
  onChange: (source: LX.OnlineSource) => void
  style?: StyleProp<ViewStyle>
}

export default memo(({ sources, active, onChange, style }: SourceIconRowProps) => {
  const theme = useTheme()
  const sourceList = useSourceListI18n(sources)

  return (
    <View style={[styles.row, style]}>
      {
        sourceList.map(({ label, action }) => {
          const isActive = action === active
          const color = isActive ? theme['c-primary'] : theme['c-450']
          // 已知品牌用 27（光学约 20dp）；未知自定义音源回退文字时用小一号，避免文字撑爆 30dp 槽位
          const iconSize = isKnownSource(action) ? HEADER_SOURCE_ICON_SIZE : 18
          return (
            <Pressable
              key={action}
              accessibilityRole='button'
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
              hitSlop={ITEM_HIT_SLOP}
              onPress={() => { if (!isActive) onChange(action as LX.OnlineSource) }}
              style={({ pressed }) => ({
                width: isKnownSource(action) ? ITEM_SIZE : undefined,
                minWidth: ITEM_SIZE,
                height: ITEM_SIZE,
                paddingLeft: isKnownSource(action) ? 0 : 8,
                paddingRight: isKnownSource(action) ? 0 : 8,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <SourceLogo source={action} label={label} size={iconSize} color={color} />
            </Pressable>
          )
        })
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
