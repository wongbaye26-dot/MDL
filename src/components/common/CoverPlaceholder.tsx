import { memo } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { contrastOn } from '@/theme/solid'

/**
 * 无封面时的占位块：主题色渐变 + 歌名首字。
 *
 * 以前没有内嵌封面的歌只显示一个音符图标，在一堆真封面里几乎认不出是哪首；
 * 换成「首字 + 渐变」后即使没有封面也能靠字形和色块快速定位。
 *
 * 渐变只用主题的 primary 色阶（不自己算色相），这样 Material You 换色时
 * 占位块会跟着变，不会出现一堆和主题打架的固定色。
 */

/** 同色系几组渐变，按歌名散列挑一组 —— 不同歌之间有点区分度，又不会跳出主题 */
const SHADE_PAIRS: Array<[string, string]> = [
  ['c-primary-dark-100', 'c-primary-dark-300'],
  ['c-primary-dark-200', 'c-primary-dark-400'],
  ['c-primary', 'c-primary-dark-200'],
  ['c-primary-light-200', 'c-primary-dark-300'],
]

const hashCode = (str: string) => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 取首字：中文取第一个字，拉丁字母转大写，其余原样 */
const initialOf = (name?: string) => {
  const text = (name ?? '').trim()
  if (!text) return ''
  const first = Array.from(text)[0]
  return /^[a-z]$/.test(first) ? first.toUpperCase() : first
}

export interface CoverPlaceholderProps {
  /** 用来取首字、并决定用哪组渐变 */
  name?: string
  /** 正方形边长；需要非正方形时用 width/height */
  size?: number
  width?: number
  height?: number
  radius?: number
  /** 首字大小，不传按尺寸自动算 */
  textSize?: number
  style?: StyleProp<ViewStyle>
}

export default memo(({
  name,
  size = 48,
  width,
  height,
  radius = 10,
  textSize,
  style,
}: CoverPlaceholderProps) => {
  const theme = useTheme()
  const w = width ?? size
  const h = height ?? size

  const [fromKey, toKey] = SHADE_PAIRS[hashCode(name ?? '') % SHADE_PAIRS.length]
  // 主题对象里除了颜色还有 isDark 之类的非字符串字段，按 key 取色时收窄一下
  const colorOf = (key: string) => (theme as unknown as Record<string, string>)[key] ?? theme['c-primary']
  const from = colorOf(fromKey)
  const to = colorOf(toKey)

  const initial = initialOf(name)
  // 小图按 40% 边长取字号；大图（播放器满屏封面）封顶，避免一个字糊满整块
  const fontSize = textSize ?? Math.round(Math.min(Math.min(w, h) * 0.4, 96))

  return (
    <View style={[{ width: w, height: h, borderRadius: radius, overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        {
          initial
            ? (
              <Text
                size={fontSize}
                color={contrastOn(to)}
                allowFontScaling={false}
                numberOfLines={1}
                style={{ fontWeight: '800' }}
              >
                {initial}
              </Text>
              )
            : null
        }
      </LinearGradient>
    </View>
  )
})
