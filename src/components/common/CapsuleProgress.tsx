import { memo } from 'react'
import Svg, { Rect } from 'react-native-svg'

/**
 * 沿胶囊外轮廓走的进度描边。
 *
 * 胶囊 = 圆角矩形（radius = 高度一半），所以直接用 SVG 的 Rect + 虚线就能让进度
 * 贴着边框跑：dash 长度 = 周长，dashoffset 从 0 走到 -周长 就是「填满一圈」。
 * 周长按「两条直边 + 两个半圆」精确算，dash 才刚好首尾相接。
 */
export default memo(({
  width,
  height,
  progress,
  color,
  trackColor = 'rgba(255,255,255,0.16)',
  strokeWidth = 2,
}: {
  width: number
  height: number
  /** 0~1 */
  progress: number
  color: string
  trackColor?: string
  strokeWidth?: number
}) => {
  if (width <= 0 || height <= 0) return null

  const inset = strokeWidth / 2
  const w = width - strokeWidth
  const h = height - strokeWidth
  const r = h / 2
  // 胶囊周长：两条直边 + 两个半圆
  const perimeter = Math.max(1, 2 * Math.max(0, w - 2 * r) + 2 * Math.PI * r)
  const ratio = Math.max(0, Math.min(1, progress))

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents='none'>
      <Rect
        x={inset}
        y={inset}
        width={w}
        height={h}
        rx={r}
        ry={r}
        fill='none'
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <Rect
        x={inset}
        y={inset}
        width={w}
        height={h}
        rx={r}
        ry={r}
        fill='none'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeDasharray={[perimeter, perimeter]}
        strokeDashoffset={perimeter * (1 - ratio)}
      />
    </Svg>
  )
})
