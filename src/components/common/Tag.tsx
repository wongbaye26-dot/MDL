import { memo } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'

/**
 * 统一的「非交互小标签」。
 *
 * 之前各处自定义标签用 paddingTop/Bottom 目测对齐，中英数混排时字形上下留白不同，
 * 看起来会偏下。这里统一保证：
 *  1. 容器用固定高度 + justifyContent/alignItems center，不靠 padding 目测；
 *  2. 文字关掉 Android 字体额外 padding（includeFontPadding: false）并把 lineHeight
 *     压到和字号匹配，避免字形在 TextView 内部被基线带着往下跑；
 *  3. 外加大 flexShrink: 0，嵌在列表行 / flex 行里时不会被压扁。
 */
export type TagTone = 'primary' | 'muted' | 'success' | 'warning' | 'danger'

export interface TagProps {
  label: string
  tone?: TagTone
  size?: 'sm' | 'md'
  /** 自定义底色（主题 token 或任意颜色），优先级高于 tone */
  bg?: string
  /** 自定义文字色，优先级高于 tone */
  color?: string
  style?: StyleProp<ViewStyle>
}

const useTagColors = (tone: TagTone) => {
  const theme = useTheme()
  switch (tone) {
    case 'primary':
      return { bg: theme['c-primary-alpha-800'], color: theme['c-primary'] }
    case 'success':
      return { bg: 'rgba(16,185,129,0.16)', color: theme.isDark ? '#34D399' : '#059669' }
    case 'warning':
      return { bg: 'rgba(232,163,61,0.18)', color: theme.isDark ? '#F0B45A' : '#B7791F' }
    case 'danger':
      return { bg: 'rgba(239,68,68,0.16)', color: theme.isDark ? '#FF6B6B' : '#D92D20' }
    case 'muted':
    default:
      return { bg: theme['c-primary-alpha-900'], color: theme['c-450'] }
  }
}

export default memo(({ label, tone = 'muted', size = 'sm', bg, color, style }: TagProps) => {
  const colors = useTagColors(tone)
  const isSm = size === 'sm'
  const height = isSm ? 18 : 22
  const fontSize = isSm ? 9.5 : 11
  const backgroundColor = bg ?? colors.bg
  const textColor = color ?? colors.color

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          flexGrow: 0,
          alignSelf: 'center',
          height,
          paddingLeft: isSm ? 6 : 8,
          paddingRight: isSm ? 6 : 8,
          borderRadius: 6,
          backgroundColor,
        },
        style,
      ]}
    >
      <Text
        size={fontSize}
        color={textColor}
        numberOfLines={1}
        style={{
          includeFontPadding: false,
          textAlignVertical: 'center',
          lineHeight: setSpText(fontSize + 2),
          fontWeight: '500',
        }}
      >{label}</Text>
    </View>
  )
})
