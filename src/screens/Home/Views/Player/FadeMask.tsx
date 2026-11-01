import { memo, type ReactNode } from 'react'
import { UIManager, View, type StyleProp, type ViewStyle } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

/**
 * 渐变遮罩。
 *
 * 之前用「N 条裁切带 + 递增 alpha」模拟渐变，8% 一档的台阶在封面上是肉眼可见的横条。
 * 这里用 MaskedView 把子视图画进图层、再用渐变做 DST_IN，渐变逐像素，完全平滑。
 *
 * 注意：遮罩元素必须用 LinearGradient（同步用 shader 绘制），
 * **不能**用 <Image>——MaskedView 在 onLayout 时就把遮罩画进一张 bitmap，
 * 图片还没解码完就是全透明，而且之后 view 被置为 INVISIBLE 后 invalidate 会被跳过，
 * 永远不会重画，表现就是「整块什么都不显示」。
 */
let MaskedView: any = View
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@react-native-masked-view/masked-view')
  if (UIManager.getViewManagerConfig?.('RNCMaskedView')) MaskedView = mod.default ?? mod
} catch (e) {}

export default memo(({
  width,
  height,
  /** 渐变起点（上/左）的 alpha */
  from,
  /** 渐变终点（下/右）的 alpha */
  to,
  dir = 'v',
  style,
  children,
}: {
  width: number
  height: number
  from: number
  to: number
  dir?: 'v' | 'h'
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) => (
  <MaskedView
    pointerEvents='none'
    style={[{ position: 'absolute', overflow: 'hidden' }, style, { width, height }]}
    maskElement={
      <LinearGradient
        colors={[`rgba(255,255,255,${from})`, `rgba(255,255,255,${to})`]}
        start={{ x: 0, y: 0 }}
        end={dir === 'h' ? { x: 1, y: 0 } : { x: 0, y: 1 }}
        style={{ width, height }}
      />
    }
  >
    {children}
  </MaskedView>
))
