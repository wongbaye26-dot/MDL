import { memo } from 'react'
import Svg, { Ellipse, Path, Rect } from 'react-native-svg'
import { Pressable, View, type ViewStyle } from 'react-native'

import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'

/**
 * 在线音源的品牌矢量 LOGO —— Material You 单色版。
 *
 * 用户要求：来源行只显示「真实的品牌矢量图标」，且是 Material You 风格的**单色**
 * 图标，不要品牌色方块底、也不要外面的小胶囊卡片；当前音源用主题主色，其余用
 * onSurfaceVariant 一档（c-450）。
 *
 * 5 个字形都画在 48×48 视框、单色填充（颜色由 color 传入），14~18dp 下仍可辨识：
 *  - kw 酷我：粗体圆头 "K" + 右侧独立的八分音符（官方标志的 K + 音符记忆点）；
 *  - kg 酷狗：狗头剪影（两只立耳 + 圆脸，眼睛/鼻子用 evenodd 镂空）；
 *  - tx QQ音乐：官方双音符（两个符头 + 两根符干 + 顶部符杠，类似 ♫）；
 *  - wy 网易云：云朵剪影 + 云内音符镂空（云 + 音符组合）；
 *  - mg 咪咕：圆拱 "m" 波形（两个圆拱 + 平底，咪咕标志记忆点）。
 * 未识别的自定义音源回退显示原文字（label / source），保持可读。
 *
 * 用法：
 *   <SourceLogo source='kw' size={18} color={...} />
 *   <SourceChip source='kw' label='小蜗音乐' active onPress={...} />   // 纯图标按钮（无胶囊底）
 */

export type KnownSource = 'kw' | 'kg' | 'tx' | 'wy' | 'mg'

export interface SourceLogoMeta {
  /** 正式名（酷我音乐 / 酷狗音乐 / QQ音乐 / 网易云音乐 / 咪咕音乐） */
  name: string
  /** 品牌色：仅作语义参考/其它场景取色用，当前单色图标不再用它做底色 */
  color: string
}

export const SOURCE_LOGO_MAP: Record<KnownSource, SourceLogoMeta> = {
  kw: { name: '酷我音乐', color: '#FF5C1F' },
  kg: { name: '酷狗音乐', color: '#2AA9E0' },
  tx: { name: 'QQ音乐', color: '#31C27C' },
  wy: { name: '网易云音乐', color: '#E60026' },
  mg: { name: '咪咕音乐', color: '#FF7A00' },
}

export const isKnownSource = (source?: string | null): source is KnownSource =>
  source != null && Object.prototype.hasOwnProperty.call(SOURCE_LOGO_MAP, source)

const VIEWBOX = 48

/** kw 酷我：粗体圆头 K + 独立的八分音符（K 是官方标志的字母记忆点） */
const KwGlyph = ({ color }: { color: string }) => (
  <>
    <Path d='M10.4 11 V37' stroke={color} strokeWidth={6.2} strokeLinecap='round' fill='none' />
    <Path d='M14.3 24 L25.8 12.4' stroke={color} strokeWidth={6.2} strokeLinecap='round' fill='none' />
    <Path d='M14.3 24 L25.8 35.6' stroke={color} strokeWidth={6.2} strokeLinecap='round' fill='none' />
    {/* 八分音符：符干 + 符尾 + 符头 */}
    <Rect x='32.6' y='9.6' width='3.2' height='15.6' rx='1.6' fill={color} transform='rotate(6 34.2 17.4)' />
    <Path d='M35.8 9.4 C39.2 10.3 41.1 12.7 41.1 16.2 L38.6 16.2 C38.6 14 37.6 12.7 35.8 12.2 Z' fill={color} transform='rotate(6 38.4 13.4)' />
    <Ellipse cx='32.2' cy='25.4' rx='4.9' ry='4' fill={color} transform='rotate(-18 32.2 25.4)' />
  </>
)

/**
 * kg 酷狗：狗头剪影。
 * 外轮廓是一整条连续路径（左耳尖→左耳根→左脸颊→下巴→右脸颊→右耳根→右耳尖→
 * 右耳内根→头顶凹陷→左耳内根），所以不会出现子路径重叠；眼睛和鼻子用 evenodd 挖空。
 */
const KgGlyph = ({ color }: { color: string }) => (
  <Path
    fill={color}
    fillRule='evenodd'
    clipRule='evenodd'
    d='M11.6 21.5 C11.6 21.5 12.6 10.8 14.2 7.6 C15.2 8.4 18.8 13.2 20.9 16.4 C21.9 16.2 22.9 16.1 24 16.1 C25.1 16.1 26.1 16.2 27.1 16.4 C29.2 13.2 32.8 8.4 33.8 7.6 C35.4 10.8 36.4 21.5 36.4 21.5 C37.9 24.1 38.6 27.4 38.3 30.6 C37.6 36.3 31.9 40.4 24 40.4 C16.1 40.4 10.4 36.3 9.7 30.6 C9.4 27.4 10.1 24.1 11.6 21.5 Z M19.3 25.4 A2.6 3.2 0 1 0 19.31 25.4 Z M28.7 25.4 A2.6 3.2 0 1 0 28.71 25.4 Z M24 31.4 A3.4 2.6 0 1 0 24.01 31.4 Z'
  />
)

/** tx QQ音乐：官方双音符（两个符头 + 两根符干 + 倾斜符杠，类似 ♫） */
const TxGlyph = ({ color }: { color: string }) => (
  <>
    <Ellipse cx='14.2' cy='34.4' rx='6' ry='4.9' fill={color} transform='rotate(-18 14.2 34.4)' />
    <Ellipse cx='28.4' cy='31.4' rx='6' ry='4.9' fill={color} transform='rotate(-18 28.4 31.4)' />
    <Rect x='17.3' y='13.6' width='3.9' height='20.6' rx='1.95' fill={color} />
    <Rect x='31.5' y='10.6' width='3.9' height='20.6' rx='1.95' fill={color} />
    <Path d='M17.3 13.6 L35.4 10.6 L35.4 15.4 L17.3 18.4 Z' fill={color} />
  </>
)

/** wy 网易云音乐：云朵剪影 + 云内音符镂空（evenodd 挖空，单色也能看出云 + 音符） */
const WyGlyph = ({ color }: { color: string }) => (
  <Path
    fill={color}
    fillRule='evenodd'
    clipRule='evenodd'
    transform='translate(-2.88 -2.88) scale(1.12)'
    d='M18.4 35.6 H32.8 C37.3 35.6 40.2 32.4 40.2 28.6 C40.2 25 37.7 22 34.2 21.6 C33 17.4 29.4 14.4 25.1 14.4 C20.1 14.4 16.2 18 15.4 22.6 C12.3 23.2 10.3 25.8 10.3 28.9 C10.3 32.5 13.2 35.6 16.9 35.6 Z M25.6 20.8 C28.2 21.4 29.8 23.3 29.8 26.2 L29.8 33.2 C29.8 35 28.4 36.4 26.6 36.4 C24.8 36.4 23.4 35 23.4 33.2 C23.4 31.4 24.8 30 26.6 30 C27.1 30 27.6 30.1 28 30.4 L28 26.5 C28 24.9 27.2 23.9 25.6 23.5 Z'
  />
)

/** mg 咪咕音乐：圆拱 m 波形（两个圆拱 + 平底） */
const MgGlyph = ({ color }: { color: string }) => (
  <Path
    fill={color}
    transform='translate(-2.4 -2.4) scale(1.1)'
    d='M11 36 V22 C11 17.2 14.8 13.4 19.6 13.4 C22.8 13.4 25.6 15.1 27 17.8 C28.4 15.1 31.2 13.4 34.4 13.4 C39.2 13.4 43 17.2 43 22 V36 H37 V22 C37 20.5 35.8 19.3 34.3 19.3 C32.8 19.3 31.6 20.5 31.6 22 V36 H25.4 V22 C25.4 20.5 24.2 19.3 22.7 19.3 C21.2 19.3 20 20.5 20 22 V36 Z'
  />
)

const Glyphs = ({ source, color }: { source: KnownSource, color: string }) => {
  switch (source) {
    case 'kw': return <KwGlyph color={color} />
    case 'kg': return <KgGlyph color={color} />
    case 'tx': return <TxGlyph color={color} />
    case 'wy': return <WyGlyph color={color} />
    case 'mg': return <MgGlyph color={color} />
  }
}

export interface SourceLogoProps {
  source?: string | null
  /** 图标边长（dp），来源行建议 14~18 */
  size?: number
  /** 未识别音源时回退显示的文字，不传则显示 source 原文 */
  label?: string
  /** 图标颜色（Material You 单色）；默认主题正文色 */
  color?: string
  style?: ViewStyle
}

const SourceLogo = memo(({ source, size = 18, label, color, style }: SourceLogoProps) => {
  const theme = useTheme()

  if (!isKnownSource(source)) {
    // 未识别的自定义音源：回退成文字（和原胶囊文字同一套居中规则）
    const fontSize = Math.max(size * 0.72, 10)
    return (
      <Text
        size={fontSize}
        color={color ?? theme['c-font']}
        numberOfLines={1}
        style={{
          fontWeight: '500',
          includeFontPadding: false,
          textAlignVertical: 'center',
          lineHeight: setSpText(fontSize + 2),
        }}
      >{label ?? source ?? ''}</Text>
    )
  }

  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Glyphs source={source} color={color ?? theme['c-font']} />
      </Svg>
    </View>
  )
})

export default SourceLogo

const SOURCE_CHIP_METRICS = {
  sm: { box: 34, icon: 18, hitSlop: 6 },
  md: { box: 38, icon: 20, hitSlop: 8 },
}

export interface SourceChipProps {
  source: string
  /** 原「小X音乐」文字：无障碍标签 + 未识别音源的回退文字 */
  label: string
  active?: boolean
  size?: 'sm' | 'md'
  onPress?: () => void
}

/**
 * 来源图标按钮（保留 SourceChip 这个名字和参数，搜索页等处无需改动）。
 *
 * 不再是胶囊：内部没有 Chip/背景/描边/圆角卡片，只有一枚 Material You 单色图标；
 * 当前音源用主题主色，其余用 c-450。点击热区是 34/38dp 透明区域 + hitSlop，
 * 按压时整体透明度下降给反馈；无障碍标签仍保留原来的「小X音乐」文字。
 * 未识别的自定义音源回退成文字按钮（仍可点、可切换）。
 */
export const SourceChip = memo(({ source, label, active = false, size = 'md', onPress }: SourceChipProps) => {
  const theme = useTheme()
  const metrics = SOURCE_CHIP_METRICS[size]
  const color = active ? theme['c-primary'] : theme['c-450']
  // 已知品牌：固定方形触控区只放图标；未知自定义音源：文字按钮，按内容自适应宽度
  const known = isKnownSource(source)

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={metrics.hitSlop}
      onPress={onPress}
      style={({ pressed }) => ({
        width: known ? metrics.box : undefined,
        minWidth: metrics.box,
        height: metrics.box,
        paddingLeft: known ? 0 : 10,
        paddingRight: known ? 0 : 10,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <SourceLogo source={source} label={label} size={metrics.icon} color={color} />
    </Pressable>
  )
})
