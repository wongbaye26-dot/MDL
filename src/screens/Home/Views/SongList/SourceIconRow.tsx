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
 * 尺寸（对齐**收藏页页头**那组圆形按钮，用户把这组当成页头图标的基准）：
 *  - 槽位 34dp：和收藏页页头的 34dp 胶囊同直径，两处页头看起来是同一档控件；
 *  - 品牌字形 20dp 名义尺寸：SourceLogo 的路径实际占满 48 视框的 36 单位（**75%**，
 *    见 SourceLogo 里「30 单位」注释的勘误），所以 20 × 0.75 ≈ **15dp 光学高度**，
 *    正好等于收藏页 18dp Material 图标的光学高度（MCI 图标实际只占 16/18 视框）。
 *    之前按注释里不成立的 62.5% 传 30，实际画成 22.5dp —— 这才是「来源图标太大」的原因，
 *    靠缩槽位救不回来；
 *  - 图标之间 **8dp**：和页头圆形按钮组（排行榜播放/下载、歌单广场打开链接）同一节奏；
 *  - 触控区：34dp 布局 + hitSlop 3 → **40dp**（相邻 gap 8 > 两侧 hitSlop 6，不会互相抢点击）；
 *  - 与右侧圆形按钮组：由调用方给 8dp 间距（CompactHero 按钮 marginLeft=8 /
 *    歌单广场 HeaderSourceBar marginRight=8）。
 *
 * 颜色：当前音源=主题主色，其余 c-450（onSurfaceVariant 档）；按压 0.5 透明度反馈；
 * 无障碍标签沿用原「小X音乐」文字；未识别自定义音源回退文字按钮。
 */
export const HEADER_SOURCE_ICON_SIZE = 20
/** 每个来源按钮的布局尺寸（配合 hitSlop 3 → 40dp 触控区） */
const ITEM_SIZE = 34
/** 与右侧圆形按钮组保持同一间距 */
const ITEM_GAP = 8
/** hitSlop：布局 34 + 3×2 = 40dp 触控区 */
const ITEM_HIT_SLOP = 3

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
