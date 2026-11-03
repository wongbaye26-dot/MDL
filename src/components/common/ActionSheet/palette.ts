import { useTheme } from '@/store/theme/hook'
import { getSolidBackground } from '@/theme/solid'

/**
 * 底部 ActionSheet 的 Material You 配色。
 *
 * 所有颜色都从主题 token 派生，所以深浅色主题、自定义主色都会自动适配：
 *   bg           → getSolidBackground(theme)：主题页面底色压平成不透明色
 *                  （主题背景图可能是半透明的，直接拿 c-main-background 会透出下层内容）
 *   card         → c-primary-alpha-900：主色最低透明度衬底，作为卡片/行底色
 *   border       → c-primary-alpha-700：卡片/行描边（比底色稍明显一点）
 *   text         → c-font：主文字（标题、行标签）
 *   textSecondary→ c-450：次文字（副标题、右侧补充值）
 *   icon         → c-font：线性图标
 *   primary      → c-primary：强调/选中（快捷操作图标、已收藏状态）
 *   danger       → 固定红（Material You 错误色，深色主题用亮红）
 *   scrim        → 遮罩黑 50%
 */
export interface SheetPalette {
  /** Sheet 背景 */
  bg: string
  /** 卡片/操作行底色 */
  card: string
  /** 卡片/操作行描边 */
  border: string
  /** 主文字 */
  text: string
  /** 次文字 */
  textSecondary: string
  /** 线性图标色 */
  icon: string
  /** 强调色（快捷操作图标、选中态） */
  primary: string
  /** 危险操作文字/图标 */
  danger: string
  /** 遮罩色 */
  scrim: string
}

export const useSheetPalette = (): SheetPalette => {
  const theme = useTheme()
  return {
    bg: getSolidBackground(theme),
    card: theme['c-primary-alpha-900'],
    border: theme['c-primary-alpha-700'],
    text: theme['c-font'],
    textSecondary: theme['c-450'],
    icon: theme['c-font'],
    primary: theme['c-primary'],
    danger: theme.isDark ? '#FF6B6B' : '#D92D20',
    scrim: 'rgba(0,0,0,0.5)',
  }
}
