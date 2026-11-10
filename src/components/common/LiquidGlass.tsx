import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

/**
 * 旧「液态玻璃」层统一降级为实色。
 *
 * 用户要求取消所有表头/胶囊任务栏的液态玻璃风格，同时它也是首页滑动、
 * 歌单广场进出卡顿和「胶囊偶发全透明」的根源（GlassBlurView 每次 preDraw 抓窗口快照）。
 * 这里保留组件 API，内部不再做模糊/流光/高光，只给一层稳定实色底，
 * 所有调用方（PageHeader / BottomNav / MiniPlayer / PlayerBar / 各列表页头）自动统一。
 */
export type LiquidGlassMode = 'liquid' | 'frosted' | 'none'

export default memo(({
  mode = 'liquid',
  radius = 0,
  isDark = true,
}: {
  mode?: LiquidGlassMode
  radius?: number
  blurRadius?: number
  tint?: string
  isDark?: boolean
  seamless?: boolean
  flat?: boolean
}) => {
  if (mode === 'none') return null
  return (
    <View
      pointerEvents='none'
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: isDark ? 'rgba(22,17,30,0.98)' : 'rgba(255,255,255,0.98)',
        },
      ]}
    />
  )
})
