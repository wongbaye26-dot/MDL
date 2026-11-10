import { memo } from 'react'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import SourceLogo, { isKnownSource } from '@/components/common/SourceLogo'
import { useSourceListI18n } from '@/components/SourceSelector'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'
import { createStyle } from '@/utils/tools'

/**
 * 页头标题右侧的「来源品牌图标组」（排行榜 / 歌单广场共用，保证两处尺寸与间距一致）。
 *
 * 尺寸（对齐右侧圆形按钮组）：
 *  - 品牌字形光学尺寸约 20dp：SourceLogo 的路径只占 48 视框的 36 单位（75%），
 *    所以传 size=27 → 实际字形 27×0.75 ≈ **20.25dp**，和按钮里的 Icon size=20 同大；
 *  - 不再画圆形底色：右侧按钮是 38dp 实心圆，图标组如果也套 30dp 圆底会显得
 *    「小一圈又挤在一起」。改成裸图标后，字形大小与按钮图标一致，节奏才对得上；
 *  - 图标之间：与按钮组相同的 **8dp** 间距（之前是 30dp 槽位紧挨、视觉只隔 ~10dp）；
 *  - 触控区：28dp 布局 + hitSlop 5 → **38dp**，和按钮同档，不会因为去掉圆底变小；
 *  - 与右侧圆形按钮组：由调用方给 8dp 间距（CompactHero 按钮 marginLeft=8 /
 *    歌单广场 HeaderSourceBar marginRight=8）。
 *
 * 颜色：当前音源=主题主色，其余 c-450（onSurfaceVariant 档）；按压 0.5 透明度反馈；
 * 无障碍标签沿用原「小X音乐」文字；未识别自定义音源回退文字按钮。
 */
export const HEADER_SOURCE_ICON_SIZE = 24
/** 每个来源按钮的布局尺寸（配合 hitSlop 5 → 38dp 触控区） */
const ITEM_SIZE = 34
/** 与右侧圆形按钮组保持同一间距 */
const ITEM_GAP = 4
/** hitSlop：布局 28 + 5×2 = 38dp 触控区 */
const ITEM_HIT_SLOP = 2

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
          /*
           * 选中态直接用主色。
           *
           * 之前这里用 contrastOn(c-primary)：那是「实心主色圆底上的对比色」，
           * 圆底去掉之后它算出来是白色，白图标画在浅色页头上等于看不见
           * （用户看到的「选中图标透明」）。
           */
          const color = isActive ? contrastOn(theme['c-primary']) : theme['c-450']
          // 已知品牌用 27（光学约 20dp）；未知自定义音源回退文字时用小一号，避免文字撑爆槽位
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
                borderRadius: ITEM_SIZE / 2,
                backgroundColor: isActive ? theme['c-primary'] : theme['c-primary-alpha-900'],
                opacity: pressed ? 0.7 : 1,
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
    gap: ITEM_GAP,
  },
})
