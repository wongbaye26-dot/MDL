import { memo } from 'react'
import Svg, { Ellipse, Path, Rect } from 'react-native-svg'
import type { ViewStyle } from 'react-native'

import { useTheme } from '@/store/theme/hook'

/**
 * 搜索类型 / 「聚合」选项的单色矢量图标。
 *
 * 和 `components/common/SourceLogo.tsx`（品牌单色矢量 LOGO）同一套视觉规则：
 *  - 统一 48×48 视框、纯单色填充（颜色由调用方传入，Material You 选中=主色/对比色、
 *    未选中=c-450），不画底色方块、不翻转/不缩放；
 *  - 光学尺寸统一在 30~32 单位，16~20dp 下三个图标大小观感一致；
 *  - 只做图形，不带可访问性语义 —— 无障碍文字由外层 Chip 的 accessibilityLabel 提供。
 *
 * 图形说明：
 *  - music    歌曲：单个八分音符（符头 + 符干 + 符尾），对应「在线歌曲搜索」；
 *  - songlist 歌单：三条渐短的列表横杠 + 右侧播放三角，对应「歌单搜索」；
 *  - aggregate 聚合：上下两层堆叠的菱形/箭头层，对应「聚合大会 / 聚合搜索」这类
 *              多音源聚合入口（注意：当前搜索类型只有 music/songlist，聚合只是
 *              音源选项 'all'，不是新增的搜索类型）。
 */
export type SearchTypeIconType = 'music' | 'songlist' | 'aggregate'

export interface SearchTypeIconProps {
  type: SearchTypeIconType
  /** 图标边长（dp），chip 内建议 16~18 */
  size?: number
  /** 单色图标颜色；默认跟随主题正文色 */
  color?: string
  style?: ViewStyle
}

const VIEWBOX = 48

/** 歌曲：八分音符（和 SourceLogo 的 tx 网易云/QQ 音乐单音符同一套观感） */
const MusicGlyph = ({ color }: { color: string }) => (
  <>
    <Rect x='22.6' y='9.4' width='4' height='24.4' rx='2' fill={color} />
    <Path
      d='M26.6 9.4 C32.2 10.8 35.4 14.3 35.4 19.5 L31.4 19.5 C31.4 15.5 29.4 12.6 26.6 11.6 Z'
      fill={color}
    />
    <Ellipse cx='17' cy='33' rx='7.2' ry='5.6' fill={color} transform='rotate(-20 17 33)' />
  </>
)

/** 歌单：三行列表 + 播放三角（列表线框的实心简化版） */
const SonglistGlyph = ({ color }: { color: string }) => (
  <>
    <Rect x='8' y='12.4' width='26.5' height='4.6' rx='2.3' fill={color} />
    <Rect x='8' y='21.7' width='20' height='4.6' rx='2.3' fill={color} />
    <Rect x='8' y='31' width='16' height='4.6' rx='2.3' fill={color} />
    <Path d='M29.6 23.6 L40 29.9 L29.6 36.2 Z' fill={color} />
  </>
)

/** 聚合：上下两层堆叠的菱形层（Material「layers」观感） */
const AggregateGlyph = ({ color }: { color: string }) => (
  <>
    <Path d='M24 9.6 L40.5 19 L24 28.4 L7.5 19 Z' fill={color} />
    <Path d='M7.5 25.4 L24 34.8 L40.5 25.4 L40.5 31.2 L24 40.6 L7.5 31.2 Z' fill={color} />
  </>
)

const SearchTypeIcon = memo(({ type, size = 18, color, style }: SearchTypeIconProps) => {
  const theme = useTheme()
  const fill = color ?? theme['c-font']

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} style={style}>
      {
        type === 'music'
          ? <MusicGlyph color={fill} />
          : type === 'songlist'
            ? <SonglistGlyph color={fill} />
            : <AggregateGlyph color={fill} />
      }
    </Svg>
  )
})

export default SearchTypeIcon
