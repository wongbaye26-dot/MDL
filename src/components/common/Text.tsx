import { memo, type ComponentProps } from 'react'
import { Text, type TextProps as _TextProps, StyleSheet, Animated, type ColorValue, type TextStyle } from 'react-native'
import { useTextShadow, useTheme } from '@/store/theme/hook'
import { getTextSize } from '@/utils/pixelRatio'
import { useFontSize } from '@/store/common/hook'
import { useAnimateColor } from '@/utils/hooks/useAnimateColor'
import { DEFAULT_DURATION, useAnimateNumber } from '@/utils/hooks/useAnimateNumber'
// import { AppColors } from '@/theme'

/**
 * Fabric 对 fontSize 做严格校验（<=0 直接抛 IllegalArgumentException）。
 * 除了本组件计算的 fontSize，调用方传进来的 style 也可能覆盖成 0（隐藏占位文本等），
 * 这里统一兜底为 1，避免一个 0 字号把整个渲染线程打崩。
 */
const clampTextStyle = (style: any) => {
  try {
    const flat = StyleSheet.flatten(style) as TextStyle | undefined
    if (flat && typeof flat.fontSize === 'number' && flat.fontSize <= 0) return [flat, { fontSize: 1 }]
  } catch {}
  return style
}

export interface TextProps extends _TextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: ColorValue
}

// const warpText = <P extends TextProps>(Component: ComponentType<TextProps>) => {
//   return ({ style, size = 15, color, children, ...props }: P) => {
//     const theme = useTheme()
//     return (
//       <Component
//         style={StyleSheet.compose({ fontFamily: 'System', fontSize: getTextSize(size) * fontScale, color: color ?? theme['c-font'] }, style)}
//         {...props}
//       >{children}</Component>
//     )
//   }
// }

export default memo(({ style, size = 15, color, children, ...props }: TextProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const fontScaleRaw = useFontSize()
  // 新架构（Fabric）对 fontSize 做严格校验：<=0 会抛
  // "FontSize should be a positive value"；启动早期 fontSize 还未加载时兜底为 1。
  const fontScale = fontScaleRaw > 0 ? fontScaleRaw : 1
  style = StyleSheet.compose(textShadow ? {
    // fontFamily: 'System',
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
    fontSize: getTextSize(size) * fontScale,
    color: color ?? theme['c-font'],
  } : {
    // fontFamily: 'System',
    fontSize: getTextSize(size) * fontScale,
    color: color ?? theme['c-font'],
  }, style)

  return (
    <Text
      style={clampTextStyle(style)}
      {...props}
    >{children}</Text>
  )
})

export interface AnimatedTextProps extends _AnimatedTextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: ColorValue
}
export const AnimatedText = ({ style, size = 15, color, children, ...props }: AnimatedTextProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const fontScaleRaw = useFontSize()
  // 新架构（Fabric）对 fontSize 做严格校验：<=0 会抛
  // "FontSize should be a positive value"；启动早期 fontSize 还未加载时兜底为 1。
  const fontScale = fontScaleRaw > 0 ? fontScaleRaw : 1
  style = StyleSheet.compose(textShadow ? {
    // fontFamily: 'System',
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
    fontSize: getTextSize(size) * fontScale,
    color: color ?? theme['c-font'],
  } : {
    // fontFamily: 'System',
    fontSize: getTextSize(size) * fontScale,
    color: color ?? theme['c-font'],
  }, style as TextStyle)

  return <Animated.Text style={clampTextStyle(style)} {...props}>{children}</Animated.Text>
}


type _AnimatedTextProps = ComponentProps<(typeof Animated)['Text']>
export interface AnimatedColorTextProps extends _AnimatedTextProps {
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: string
  /**
   * 字体透明度
   */
  opacity?: number
}
export const AnimatedColorText = ({ style, size = 15, opacity: _opacity, color: _color, children, ...props }: AnimatedColorTextProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const fontScaleRaw = useFontSize()
  // 新架构（Fabric）对 fontSize 做严格校验：<=0 会抛
  // "FontSize should be a positive value"；启动早期 fontSize 还未加载时兜底为 1。
  const fontScale = fontScaleRaw > 0 ? fontScaleRaw : 1

  const [color] = useAnimateColor(_color ?? theme['c-font'])
  const [opacity] = useAnimateNumber(_opacity ?? 1, DEFAULT_DURATION, false)

  style = StyleSheet.compose(textShadow ? {
    // fontFamily: 'System',
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
    fontSize: getTextSize(size) * fontScale,
    color: color as unknown as ColorValue,
    opacity,
  } : {
    // fontFamily: 'System',
    fontSize: getTextSize(size) * fontScale,
    color: color as unknown as ColorValue,
    opacity,
  }, style as TextStyle)

  return <Animated.Text style={clampTextStyle(style)} {...props}>{children}</Animated.Text>
}
