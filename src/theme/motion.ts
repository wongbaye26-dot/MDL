import { Easing } from 'react-native'

/**
 * 全站动效令牌。
 *
 * 背景：3.8.8 之前的动画时长散落在 6+ 个文件里（460/300/280/260/200/170/110ms），
 * 同类交互节奏不一致，也没有任何「减少动态效果」的注入点。
 *
 * 约定：
 * - 新增/修改动画时**必须**引用这里的时长与曲线，不要再写魔法数字；
 * - 需要跟随「减少动态效果」的动画，用 `motionDuration(key, reduced)` 取时长；
 * - 长驻循环动画（首页四卡、圆盘呼吸）在 reduced 时必须整体停掉，
 *   而不是把时长设成 0（0 会让 loop 变成死循环刷帧）。
 */
export const MotionDuration = {
  /** 立即完成，用于 reduced motion */
  instant: 0,
  /** 按压、开关等微反馈 */
  fast: 110,
  /** 菜单/浮层进出 */
  quick: 170,
  /** 常规状态切换 */
  normal: 200,
  /** 强调型过渡（多选栏、搜索条） */
  emphasized: 300,
  /** 整页/共享元素转场 */
  page: 460,
  /** 收起飞回，通常比 page 短 */
  pageClose: 300,
} as const

export type MotionDurationKey = keyof typeof MotionDuration

export const MotionEasing = {
  /** 标准减速曲线（Material 标准） */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** 强调曲线，用于播放器展开 */
  emphasized: Easing.bezier(0.22, 0.9, 0.28, 1),
  /** 进场减速 */
  decelerate: Easing.out(Easing.cubic),
  /** 退场加速 */
  accelerate: Easing.in(Easing.cubic),
  /** 整页收起曲线（播放器共享元素 1 → 0） */
  pageExit: Easing.bezier(0.4, 0, 0.55, 1),
} as const

export const MotionSpring = {
  /** 常规回弹（底部导航圆底、进度条回位） */
  soft: { friction: 9, tension: 80 },
  /** 更快的回弹（拖动松手） */
  snappy: { friction: 7, tension: 110 },
} as const

/** 取时长；reduced 时返回 0，调用方应直接落终态而不是播放动画 */
export const motionDuration = (key: MotionDurationKey, reduced = false): number =>
  reduced ? MotionDuration.instant : MotionDuration[key]

/** reduced 时该动画是否应该跳过（长驻循环动画必须用它做门控） */
export const motionEnabled = (reduced = false): boolean => !reduced
