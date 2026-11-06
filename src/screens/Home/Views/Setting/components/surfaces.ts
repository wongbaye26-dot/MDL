import { type ViewStyle } from 'react-native'

/**
 * 设置页的卡片/图标底色。
 *
 * 设置页不铺自己的背景色，和本地音乐 / 下载中心等页面共用同一层页面背景；
 * 浅色主题下不再出现整块白色卡片，只有彩色图标底和分隔线；
 * 深色主题保留一层很淡的玻璃卡，避免深色背景上文字和图标糊在一起。
 */

const hexToRgba = (hex: string, alpha: number) => {
  if (!/^#[\da-f]{6}$/i.test(hex)) return hex
  const value = Number.parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const getCardBackground = (theme: LX.ActiveTheme) => (
  theme.isDark ? 'rgba(33, 28, 46, 0.55)' : theme['c-primary-alpha-900']
)

export const getCardBorder = (theme: LX.ActiveTheme) => (
  theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(120, 100, 160, 0.06)'
)

export const getDividerColor = (theme: LX.ActiveTheme) => (
  theme.isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(120, 100, 160, 0.10)'
)

/** 图标底色：有识别色用识别色 14%（深色 20%），否则用主题主色淡底 */
export const getTileBackground = (theme: LX.ActiveTheme, color?: string) => (
  color ? hexToRgba(color, theme.isDark ? 0.22 : 0.14) : theme['c-primary-alpha-900']
)

export const getIconColor = (theme: LX.ActiveTheme, color?: string) => color ?? theme['c-primary']

/** 浅色主题不投影、不描边；深色主题只保留很淡的层次 */
export const getCardShadow = (theme: LX.ActiveTheme): ViewStyle => (
  theme.isDark
    ? { elevation: 0 }
    : {}
)
