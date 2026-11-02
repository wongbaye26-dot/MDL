import { memo } from 'react'
import { Animated } from 'react-native'
import Svg, { Path } from 'react-native-svg'

/**
 * 胶囊边缘的播放进度光晕。
 *
 * 飞牛音乐的底部胶囊**没有边框线**，所以这里也不画边框：
 * 进度表现为「贴着胶囊边缘的一圈柔光」——三层同心描边（外晕 / 中光 / 细芯）
 * 由宽到窄、由淡到亮叠出来，再整体做呼吸动画（透明度缓慢起伏）。
 *
 * 之前是一条 1.4dp 实线 + 一层 glow，颜色太实，看起来就是「线框上又套了一根线」；
 * 现在没有任何线，只有光。
 *
 * 路径从**左侧正中**起笔顺时针绕一圈：进度小时从左边亮起来，顺着阅读方向。
 * 胶囊是圆角矩形，用两条直边 + 两个半圆拼 Path，周长精确、首尾能接上。
 */

/** 最外层光晕的宽度，用来决定路径要往里缩多少（否则会被 overflow 裁掉） */
const HALO_WIDTH = 8.5
const INSET = HALO_WIDTH / 2 + 0.5

export default memo(({
  width,
  height,
  progress,
  color,
  breathe,
}: {
  width: number
  height: number
  /** 0~1；为 0 时什么都不画（胶囊完全干净，没有边框） */
  progress: number
  color: string
  /** 呼吸动画值（0.75~1） */
  breathe: Animated.Value
}) => {
  if (width <= 0 || height <= 0) return null

  const r = Math.max(0, (height - INSET * 2) / 2)
  const right = width - INSET - r
  const left = INSET + r
  const top = INSET
  const bottom = height - INSET
  const midY = height / 2

  const d = [
    `M ${INSET} ${midY}`,
    `A ${r} ${r} 0 0 1 ${left} ${top}`,
    `L ${right} ${top}`,
    `A ${r} ${r} 0 0 1 ${right} ${bottom}`,
    `L ${left} ${bottom}`,
    `A ${r} ${r} 0 0 1 ${INSET} ${midY}`,
    'Z',
  ].join(' ')

  // 周长 = 两条直边 + 两个半圆（半圆合计一个整圆）
  const straight = Math.max(0, right - left)
  const perimeter = Math.max(1, 2 * straight + 2 * Math.PI * r)
  const ratio = Math.max(0, Math.min(1, progress))

  if (ratio <= 0.002) return null

  const dash = perimeter * ratio
  const arc = (strokeWidth: number, opacity: number) => (
    <Path
      d={d}
      fill='none'
      stroke={color}
      strokeWidth={strokeWidth}
      strokeOpacity={opacity}
      strokeLinecap='round'
      strokeDasharray={[dash, perimeter]}
    />
  )

  return (
    <Animated.View
      pointerEvents='none'
      style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: breathe }}
    >
      <Svg width={width} height={height}>
        {/* 外晕 → 中光 → 细芯：四层叠加，整体压得很淡，看起来是「边缘在呼吸」而不是一条线 */}
        {arc(8.5, 0.04)}
        {arc(5.5, 0.07)}
        {arc(3, 0.13)}
        {arc(1.4, 0.30)}
      </Svg>
    </Animated.View>
  )
})
