import { useTheme } from '@/store/theme/hook'

/**
 * 「更多」Sheet 和「歌曲信息」页的中性配色（对齐飞牛音乐）。
 *
 * 为什么不用主题 token：参考图是一套中性 UI —— 页面 #F3F3F3、白卡片、#111 主文字、
 * #8A8A8A 次文字；而 EMO 的主题 token 带 Material You 主色，还可能是半透明（为了透背景图），
 * 直接套上去和参考图差得很远，深色下卡片也会发灰。
 * 所以这里只借用 `theme.isDark` 决定明暗，色阶本身固定成中性值：
 * 浅色一套、深色一套等价色（#111113 底 / #1C1C1E 卡 / #F2F2F2 字）。
 */
export interface NeutralPalette {
  /** 页面底色（Sheet 背景 / 信息页背景） */
  bg: string
  /** 卡片、输入框、圆形按钮的底色 */
  card: string
  /** 主文字（歌名、字段值、行标题） */
  text: string
  /** 次文字（歌手、字段说明、占位符、统计卡标题） */
  textSecondary: string
  /** 分隔线 / 输入框描边 */
  divider: string
  /** 遮罩色：50% 黑 */
  scrim: string
  /** 危险操作文字（删除文件） */
  danger: string
  /** 线性图标色（参考图里就是纯黑 / 纯白线稿图标） */
  icon: string
}

const LIGHT: NeutralPalette = {
  bg: '#F3F3F3',
  card: '#FFFFFF',
  text: '#111111',
  textSecondary: '#8A8A8A',
  divider: 'rgba(0,0,0,0.07)',
  scrim: 'rgba(0,0,0,0.5)',
  danger: '#D92D20',
  icon: '#111111',
}

const DARK: NeutralPalette = {
  bg: '#111113',
  card: '#1C1C1E',
  text: '#F2F2F2',
  textSecondary: '#98989E',
  divider: 'rgba(255,255,255,0.09)',
  scrim: 'rgba(0,0,0,0.62)',
  danger: '#FF6B6B',
  icon: '#F2F2F2',
}

export const useNeutralPalette = (): NeutralPalette => {
  const theme = useTheme()
  return theme.isDark ? DARK : LIGHT
}
