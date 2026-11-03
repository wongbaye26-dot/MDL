import { useSheetPalette } from '@/components/common/ActionSheet'

/**
 * 「更多」Sheet 和「歌曲信息」页的配色。
 *
 * 上一轮这里是一套写死的中性色（飞牛音乐的中性 UI）；本轮统一成 Material You：
 * 直接复用共用底部 Sheet 的配色（`@/components/common/ActionSheet` 的 useSheetPalette），
 * 因此会跟随主题主色、深浅色主题自动适配：
 *   bg          → getSolidBackground(theme)（不透明页面底色）
 *   card        → c-primary-alpha-900（卡片底色）
 *   text        → c-font；textSecondary → c-450
 *   divider     → c-primary-alpha-700（分隔线 / 描边）
 *   icon        → c-font
 *   danger      → 固定红（深色主题用亮红）
 *
 * 字段名保持旧接口不变，所以 SongInfoPage 只用换掉配色来源、布局不用动。
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
  /** 线性图标色 */
  icon: string
}

export const useNeutralPalette = (): NeutralPalette => {
  const sheet = useSheetPalette()
  return {
    bg: sheet.bg,
    card: sheet.card,
    text: sheet.text,
    textSecondary: sheet.textSecondary,
    divider: sheet.border,
    scrim: sheet.scrim,
    danger: sheet.danger,
    icon: sheet.icon,
  }
}
