import { memo, useMemo } from 'react'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

/**
 * 底部胶囊导航的四个矢量图标（首页 / 下载 / 本地音乐 / 我的）。
 *
 * 48×48 视框，字形收在 ~7..41（约 34 单位）里：
 * 胶囊里按 27dp 渲染时字形约 18~19dp，和飞牛真机实测的 17×17dp 基本一致
 * （旧版字形几乎顶满 48 视框，27dp 渲染出来 22.5dp，显得「顶满圆底」）。
 *
 * 两种状态共用同一套字形：
 *  - 未选中：线性描边，stroke 3.2、圆头圆角，观感更软更圆润；
 *  - 选中：实心变体，上实下透的主题色渐变（双色），叠在主题色圆底上层次更足。
 * 渐变用 userSpaceOnUse，保证同一个图标里多个实心块的明暗走势一致。
 */
export type TabIconName = 'home' | 'download' | 'folder' | 'me'

export interface TabIconProps {
  name: TabIconName
  size?: number
  color: string
  /** 选中态：实心渐变变体；未选中是线性描边 */
  active?: boolean
}

type Shape =
  | { d: string, fill?: string, fillOpacity?: number }
  | { cx: number, cy: number, r: number, fill?: string, fillOpacity?: number }

const OUTLINE: Record<TabIconName, Shape[]> = {
  home: [
    // 屋顶和墙体一笔画完：圆角都落在折点和底部两角上，不加多余装饰线
    { d: 'M7.6 20.4 V34.2 A5.2 5.2 0 0 0 12.8 39.4 H35.2 A5.2 5.2 0 0 0 40.4 34.2 V20.4 L24 7.6 Z' },
    { d: 'M20.8 39.4 V31.8 A3.2 3.2 0 0 1 27.2 31.8 V39.4' },
  ],
  download: [
    { d: 'M24 8.6 V25.8' },
    { d: 'M16.6 19 L24 26.2 L31.4 19' },
    { d: 'M9.8 30 V33.6 A4.8 4.8 0 0 0 14.6 38.4 H33.4 A4.8 4.8 0 0 0 38.2 33.6 V30' },
  ],
  folder: [
    {
      d: 'M7.8 16.6 A4.8 4.8 0 0 1 12.6 11.8 H19.6 A3.2 3.2 0 0 1 22.1 13 L25.2 16.6 H35.4 A4.8 4.8 0 0 1 40.2 21.4 V33.4 A4.8 4.8 0 0 1 35.4 38.2 H12.6 A4.8 4.8 0 0 1 7.8 33.4 Z',
    },
    { d: 'M31 19.6 V30.4' },
    { cx: 27.8, cy: 31.6, r: 3.2 },
  ],
  me: [
    { cx: 24, cy: 16.2, r: 6.6 },
    { d: 'M9.4 38.8 A14.6 12.8 0 0 1 38.6 38.8' },
  ],
}

/** 实心变体：同一形状填主题色渐变，再叠一层半透明白做「双色」高光面 */
const SOLID: Record<TabIconName, Shape[]> = {
  home: [
    { d: 'M7.6 20.4 V34.2 A5.2 5.2 0 0 0 12.8 39.4 H35.2 A5.2 5.2 0 0 0 40.4 34.2 V20.4 L24 7.6 Z', fill: 'gradient' },
    { d: 'M20.8 39.4 V31.8 A3.2 3.2 0 0 1 27.2 31.8 V39.4 Z', fill: '#FFFFFF', fillOpacity: 0.5 },
  ],
  download: [
    {
      d: 'M9.8 30 H38.2 V33.6 A4.8 4.8 0 0 1 33.4 38.4 H14.6 A4.8 4.8 0 0 1 9.8 33.6 Z',
      fill: 'gradient',
    },
    {
      d: 'M21.7 8.6 H26.3 A1.2 1.2 0 0 1 27.5 9.8 V19.8 H30.5 A1.5 1.5 0 0 1 31.6 22.45 L25.05 29.1 A1.5 1.5 0 0 1 22.95 29.1 L16.4 22.45 A1.5 1.5 0 0 1 17.5 19.8 H20.5 V9.8 A1.2 1.2 0 0 1 21.7 8.6 Z',
      fill: 'gradient',
    },
  ],
  folder: [
    {
      d: 'M7.8 16.6 A4.8 4.8 0 0 1 12.6 11.8 H19.6 A3.2 3.2 0 0 1 22.1 13 L25.2 16.6 H35.4 A4.8 4.8 0 0 1 40.2 21.4 V33.4 A4.8 4.8 0 0 1 35.4 38.2 H12.6 A4.8 4.8 0 0 1 7.8 33.4 Z',
      fill: 'gradient',
    },
    { d: 'M29.9 19.6 H32.1 V30.4 H29.9 Z', fill: '#FFFFFF', fillOpacity: 0.5 },
    { cx: 27.8, cy: 31.6, r: 3.2, fill: '#FFFFFF', fillOpacity: 0.5 },
  ],
  me: [
    { cx: 24, cy: 16.2, r: 6.6, fill: 'gradient' },
    {
      d: 'M9.4 38.8 C10.4 30.6 16.4 23.6 24 23.6 C31.6 23.6 37.6 30.6 38.6 38.8 Z',
      fill: 'gradient',
    },
  ],
}

/** 渐变 id 必须全局唯一：同一个页面会同时挂多个 TabIcon（竖屏/横屏导航） */
let gradientSeed = 0

const renderShapes = (shapes: Shape[], color: string, gradientId: string, outline: boolean) => (
  shapes.map((shape, index) => {
    const fill = shape.fill === 'gradient' ? `url(#${gradientId})` : (shape.fill ?? 'none')
    const common = {
      key: index,
      fill,
      fillOpacity: shape.fillOpacity,
      ...(outline
        ? {
            stroke: color,
            strokeWidth: 3.2,
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
          }
        : null),
    }
    return 'd' in shape
      ? <Path d={shape.d} {...common} />
      : <Circle cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />
  })
)

export default memo(({ name, size = 27, color, active = false }: TabIconProps) => {
  // 每次挂载拿一个唯一 id；未选中态不渲染渐变，但仍然先取好，避免切换时换 id 造成闪动
  const gradientId = useMemo(() => `tabIconFill${++gradientSeed}`, [])

  if (!active) {
    return (
      <Svg width={size} height={size} viewBox='0 0 48 48' fill='none'>
        {renderShapes(OUTLINE[name], color, gradientId, true)}
      </Svg>
    )
  }

  return (
    <Svg width={size} height={size} viewBox='0 0 48 48' fill='none'>
      <Defs>
        {/* userSpaceOnUse：多个实心块共用一条自顶向下的明暗渐变，双色过渡更连贯 */}
        <LinearGradient id={gradientId} gradientUnits='userSpaceOnUse' x1='0' y1='7' x2='0' y2='41'>
          <Stop offset='0' stopColor={color} stopOpacity={1} />
          <Stop offset='1' stopColor={color} stopOpacity={0.55} />
        </LinearGradient>
      </Defs>
      {renderShapes(SOLID[name], color, gradientId, false)}
    </Svg>
  )
})
