import { type ViewStyle } from 'react-native'

import { contrastOn } from './solid'

/**
 * 项目级 Design Tokens（见 design/DESIGN-SYSTEM.md）。
 *
 * 约束：
 * - 页面不再各自写 fontSize / borderRadius / 间距散值，统一从这里取；
 * - 颜色只允许主题 token 或这里的语义色，不允许页面写死 hex/rgba；
 * - 现有主题色阶（c-primary-* / c-*）继续由主题生成器提供，这里只做语义映射。
 */

/** 字号（逻辑值，Text 组件会乘用户字号倍率） */
export const Type = {
  pageTitle: { fontSize: 22, fontWeight: '700' as const },
  sectionLabel: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6 },
  rowTitle: { fontSize: 14, fontWeight: '500' as const },
  rowDesc: { fontSize: 12, fontWeight: '400' as const },
  value: { fontSize: 12, fontWeight: '500' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
  button: { fontSize: 12, fontWeight: '600' as const },
} as const

/** 4dp 基准间距 */
export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const

/** 圆角 */
export const Radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const

/** 图标尺寸 */
export const IconSize = { sm: 16, md: 20, lg: 24, xl: 28 } as const

/** 行高（用于 Text style 或描述行） */
export const LineHeight = { rowTitle: 20, rowDesc: 16, caption: 14, pageTitle: 28 } as const

export type ActiveTheme = LX.ActiveTheme

/** 危险操作（删除 / 清空 / 不可逆） */
export const getDanger = (theme: ActiveTheme): string => theme.isDark ? '#F87171' : '#C62828'
/** 警告（权限缺失 / 风险提示） */
export const getWarning = (theme: ActiveTheme): string => theme.isDark ? '#FBBF24' : '#B26A00'
/** 成功（已完成 / 已开启） */
export const getSuccess = (theme: ActiveTheme): string => theme.isDark ? '#34D399' : '#2E7D32'

/** 设置分组/普通容器的 tonal 表面（替代各页面写死的 rgba） */
export const getCardSurface = (theme: ActiveTheme): string => (
  theme.isDark ? theme['c-primary-dark-300-alpha-200'] : theme['c-primary-alpha-900']
)

/** 分割线（0.5dp 高） */
export const getDivider = (theme: ActiveTheme): string => (
  theme.isDark ? theme['c-primary-light-600-alpha-100'] : theme['c-primary-alpha-200']
)

/** 浮层/页头玻璃 tint：集中一处，PageHeader 与其它浮层共用 */
export const getGlassTint = (theme: ActiveTheme): string => (
  theme.isDark ? 'rgba(20,16,28,0.42)' : 'rgba(255,255,255,0.34)'
)

/** 主色实心上的前景色（自动明暗） */
export const getOnPrimary = (theme: ActiveTheme): string => contrastOn(theme['c-primary'])

/** 设置页平铺行的分隔线样式 */
export const rowDividerStyle = (theme: ActiveTheme): ViewStyle => ({
  height: 0.5,
  backgroundColor: getDivider(theme),
  marginLeft: Space.lg,
})
