import { memo } from 'react'
import Svg, { Circle, Path } from 'react-native-svg'

/**
 * 投屏图标（广播波纹「(( • ))」风格）。
 *
 * 造型参考用户提供的 podcast svg：中间一个圆点，左右各两道同心弧线。
 * 状态区分：
 *  - 待投屏（active=false）：细描边 + 空心圆点，和顶栏其它图标一样是轻量线稿；
 *  - 正在投屏（active=true）：加粗弧线 + 实心圆点 + 主题色，视觉上明显「开着」。
 */

const CENTER = 12

const arcPath = (radius: number, fromDeg: number, toDeg: number) => {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const x1 = CENTER + radius * Math.cos(rad(fromDeg))
  const y1 = CENTER + radius * Math.sin(rad(fromDeg))
  const x2 = CENTER + radius * Math.cos(rad(toDeg))
  const y2 = CENTER + radius * Math.sin(rad(toDeg))
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

// 左右对称的两道外弧、两道内弧（±52° 的张角，跟参考图的比例接近）
const OUTER_LEFT = arcPath(9.2, 128, 232)
const OUTER_RIGHT = arcPath(9.2, -52, 52)
const INNER_LEFT = arcPath(5.5, 128, 232)
const INNER_RIGHT = arcPath(5.5, -52, 52)

export interface CastIconProps {
  size?: number
  /** 正在投屏：加粗 + 实心圆点 + activeColor */
  active?: boolean
  /** 待投屏时使用的颜色 */
  color?: string
  /** 正在投屏时使用的颜色（一般传主题主色） */
  activeColor?: string
}

export default memo(({ size = 24, active = false, color = '#FFFFFF', activeColor = '#3DDC84' }: CastIconProps) => {
  const stroke = active ? activeColor : color
  const strokeWidth = active ? 2.5 : 1.7
  return (
    <Svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
      <Path d={OUTER_LEFT} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap='round' />
      <Path d={OUTER_RIGHT} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap='round' />
      <Path d={INNER_LEFT} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap='round' />
      <Path d={INNER_RIGHT} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap='round' />
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={active ? 2.4 : 2.1}
        fill={active ? activeColor : 'none'}
        stroke={active ? 'none' : stroke}
        strokeWidth={active ? 0 : strokeWidth}
      />
    </Svg>
  )
})
