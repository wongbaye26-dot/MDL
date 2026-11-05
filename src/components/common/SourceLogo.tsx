import { memo } from 'react'
import Svg, { Ellipse, Path, Rect } from 'react-native-svg'
import { View, type ViewStyle } from 'react-native'

import Text from './Text'
import Chip from './Chip'
import { useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'

/**
 * 在线音源的品牌矢量 LOGO（react-native-svg，无位图资源）。
 *
 * 排行榜 / 歌单广场 / 搜索页的来源胶囊现在只显示品牌 LOGO（用户要求），
 * 不再显示「小蜗音乐 / 小枸音乐 …」这类别名文字；未识别的自定义音源仍回退文字。
 *
 * 每个 LOGO 都画在 48×48 视框里：
 *  - 品牌色圆角方块（模拟各音乐 App 的图标底色）+ 白色品牌字形；
 *  - 字形做了区分：kw 双音符、kg 狗头、tx 单音符、wy 云+音符、mg M 波形；
 *  - 底部按 14~16dp 渲染时字形仍可辨识（chip 内使用）。
 *
 * 用法：
 *   <SourceLogo source='kw' size={16} />
 *   <SourceChip source='kw' label='小蜗音乐' active onPress={...} />
 */

export type KnownSource = 'kw' | 'kg' | 'tx' | 'wy' | 'mg'

export interface SourceLogoMeta {
  /** 正式名（酷我音乐 / 酷狗音乐 / QQ音乐 / 网易云音乐 / 咪咕音乐） */
  name: string
  /** 品牌色（圆角方块底色） */
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
/** 品牌色方块：留 2 的内边距，圆角按 13/48 ≈ 27%，接近 App 图标的圆角比例 */
const BADGE = { x: 2, y: 2, width: 44, height: 44, rx: 13 }

/** kw 酷我：白色双音符（两个符头 + 符干 + 符杠） */
const KwGlyph = () => (
  <>
    <Path d='M16.6 15.6 L31.4 12.4 L31.4 16.6 L16.6 19.8 Z' fill='#FFFFFF' />
    <Rect x='16.8' y='16.4' width='3.4' height='16.2' rx='1.7' fill='#FFFFFF' />
    <Rect x='29.6' y='13.2' width='3.4' height='16.2' rx='1.7' fill='#FFFFFF' />
    <Ellipse cx='14.4' cy='32.6' rx='5' ry='4.1' fill='#FFFFFF' transform='rotate(-16 14.4 32.6)' />
    <Ellipse cx='27.2' cy='29.4' rx='5' ry='4.1' fill='#FFFFFF' transform='rotate(-16 27.2 29.4)' />
  </>
)

/** kg 酷狗：白色狗头（两只立耳 + 圆头），眼睛/鼻子用品牌蓝挖出来 */
const KgGlyph = ({ color }: { color: string }) => (
  <>
    <Path d='M12.6 20.2 L15.2 8.8 L21.8 16.2 Z' fill='#FFFFFF' />
    <Path d='M35.4 20.2 L32.8 8.8 L26.2 16.2 Z' fill='#FFFFFF' />
    <Path d='M24 13.4 C30.9 13.4 36.4 18.6 36.4 25.4 C36.4 32.2 30.9 37.4 24 37.4 C17.1 37.4 11.6 32.2 11.6 25.4 C11.6 18.6 17.1 13.4 24 13.4 Z' fill='#FFFFFF' />
    <Ellipse cx='19.6' cy='25.6' rx='2.4' ry='2.9' fill={color} />
    <Ellipse cx='28.4' cy='25.6' rx='2.4' ry='2.9' fill={color} />
    <Ellipse cx='24' cy='32' rx='3.4' ry='2.5' fill={color} />
  </>
)

/** tx QQ音乐：白色单音符 */
const TxGlyph = () => (
  <>
    <Rect x='24.2' y='12.6' width='3.5' height='20.8' rx='1.75' fill='#FFFFFF' />
    <Path d='M27.7 12.6 C32.6 14.1 35.6 17.6 35.6 22.6 L32.3 22.6 C32.3 19.2 30.2 16.9 27.7 16 Z' fill='#FFFFFF' />
    <Ellipse cx='19.6' cy='33.2' rx='6.1' ry='5' fill='#FFFFFF' transform='rotate(-18 19.6 33.2)' />
  </>
)

/** wy 网易云：白色云朵 + 挖出品牌红的音符 */
const WyGlyph = ({ color }: { color: string }) => (
  <>
    <Path
      d='M18.6 34.2 H33.2 C37.5 34.2 40.2 31.2 40.2 27.6 C40.2 24.1 37.8 21.3 34.3 21 C33 16.9 29.4 14.2 25.2 14.2 C20.3 14.2 16.4 17.8 15.6 22.4 C12.4 23 10.4 25.5 10.4 28.5 C10.4 31.9 13 34.2 16.3 34.2 Z'
      fill='#FFFFFF'
    />
    <Rect x='24.9' y='20.6' width='2.8' height='9.8' rx='1.4' fill={color} />
    <Path d='M27.7 20.6 C30.6 21.5 32.1 23.3 32.1 26 L29.9 26 C29.9 24.3 28.9 22.9 27.7 22.4 Z' fill={color} />
    <Ellipse cx='22.4' cy='30.4' rx='3.6' ry='3' fill={color} transform='rotate(-18 22.4 30.4)' />
  </>
)

/** mg 咪咕：白色 M 波动字形（两个圆拱 + 平底） */
const MgGlyph = () => (
  <Path
    d='M10.6 34.4 V21.6 C10.6 16.9 14.3 13.2 19 13.2 C22.2 13.2 25 14.9 26.4 17.6 C27.8 14.9 30.6 13.2 33.8 13.2 C38.5 13.2 42.2 16.9 42.2 21.6 V34.4 H36.3 V21.6 C36.3 20.2 35.2 19.1 33.8 19.1 C32.4 19.1 31.3 20.2 31.3 21.6 V34.4 H25.4 V21.6 C25.4 20.2 24.3 19.1 22.9 19.1 C21.5 19.1 20.4 20.2 20.4 21.6 V34.4 Z'
    fill='#FFFFFF'
  />
)

const Glyphs = ({ source, color }: { source: KnownSource, color: string }) => {
  switch (source) {
    case 'kw': return <KwGlyph />
    case 'kg': return <KgGlyph color={color} />
    case 'tx': return <TxGlyph />
    case 'wy': return <WyGlyph color={color} />
    case 'mg': return <MgGlyph />
  }
}

export interface SourceLogoProps {
  source?: string | null
  /** 图标边长（dp），chip 内建议 14~16 */
  size?: number
  /** 未识别音源时回退显示的文字，不传则显示 source 原文 */
  label?: string
  /** 回退文字颜色（默认跟随主题正文色） */
  color?: string
  style?: ViewStyle
}

const SourceLogo = memo(({ source, size = 16, label, color, style }: SourceLogoProps) => {
  const theme = useTheme()

  if (!isKnownSource(source)) {
    // 未识别的自定义音源：回退成文字，居中规则与 common/Chip 的 label 一致
    const fontSize = Math.max(size * 0.8, 9)
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
        <Rect {...BADGE} fill={SOURCE_LOGO_MAP[source].color} />
        <Glyphs source={source} color={SOURCE_LOGO_MAP[source].color} />
      </Svg>
    </View>
  )
})

export default SourceLogo

export interface SourceChipProps {
  source: string
  /** 原「小X音乐」文字：无障碍标签 + 未识别音源的回退文字 */
  label: string
  active?: boolean
  size?: 'sm' | 'md'
  onPress?: () => void
}

/**
 * 只显示品牌 LOGO 的来源胶囊。
 *
 * 直接复用 common/Chip（同一套 visual token：26/30 高、圆角胶囊、主色淡底/选中实心、
 * 按压回弹），只是用 children 分支塞 SourceLogo 取代文字；label 仍作为
 * accessibilityLabel 保留原来的「小X音乐」文字，点击/切换行为完全不变。
 * 未识别的自定义音源自动回退成文字胶囊（SourceLogo 内部渲染 label）。
 * 搜索页/本地音乐等其它来源胶囊可以直接 import 这个组件。
 */
export const SourceChip = memo(({ source, label, active = false, size = 'md', onPress }: SourceChipProps) => {
  const theme = useTheme()
  const isSm = size === 'sm'
  return (
    <Chip
      size={size}
      active={active}
      accessibilityLabel={label}
      onPress={onPress}
    >
      <SourceLogo
        source={source}
        label={label}
        size={isSm ? 14 : 16}
        color={active ? '#FFFFFF' : theme['c-450']}
      />
    </Chip>
  )
})
