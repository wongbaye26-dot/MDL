import { Animated, Easing } from 'react-native'

/**
 * 播放器封面共享元素转场。
 *
 * 底部胶囊的圆盘（圆形 48dp）和播放器封面（全宽矩形）是同一个封面，
 * 这里用一份「展开程度」progress 把两者连起来：
 *   progress = 1 → 封面在播放器里的位置和尺寸
 *   progress = 0 → 封面在底部圆盘里的位置和尺寸
 *
 * 打开时 progress 由 timing 从 0 跑到 1；下滑时由手势直接 setValue（真正跟手），
 * 松手没到阈值就 spring 回 1，到阈值就 timing 到 0 再切回首页。
 *
 * 用模块级单例而不是 context：转场要跨 PagerView 的页面边界
 * （圆盘在 BottomNav、封面在 Player 页里），走 context 得把它们包在同一个 Provider 下，
 * 会动到页面结构；单例只加一个订阅，不动任何现有层级。
 */

export interface TransitionRect {
  x: number
  y: number
  width: number
  height: number
}

export type TransitionPhase = 'idle' | 'opening' | 'closing'

interface TransitionState {
  phase: TransitionPhase
  /** 圆盘在屏幕上的位置（收起态，正圆） */
  from: TransitionRect | null
  /** 播放器封面矩形（展开态） */
  to: TransitionRect | null
  /** 中间态的「大圆」：下拉一开始封面先收成这个大圆，再一路缩回圆盘 */
  circle: TransitionRect | null
}

let state: TransitionState = { phase: 'idle', from: null, to: null, circle: null }
const listeners = new Set<() => void>()

/** 0 = 收起（圆盘），1 = 展开（播放器封面） */
export const progressAnim = new Animated.Value(0)

/**
 * 播放器页的竖向位移。
 *
 * 放在这里而不是 Player 组件内部，是因为**手势必须在 PagerView 外面识别**：
 * PagerView 是原生 ViewPager，会把竖向拖动的触摸序列抢走
 * （实测 PanResponder 只能收到 dy=4~7 就断了，页面根本不动）。
 * 所以由 PagerView 外面的手势层写这个值，Player 只负责读它做 translateY。
 */
export const dragY = new Animated.Value(0)


const emit = () => {
  for (const listener of listeners) listener()
}

export const subscribeTransition = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getTransitionState = (): TransitionState => state

/** 有没有「从圆盘打开」的记录 —— 没有就不做共享元素，直接用原来的切页 */
export const canTransition = () => state.from != null && state.to != null

/**
 * 记录一次「从圆盘打开」，并开始放大动画。
 * @param circle 中间态的大圆（下拉时封面先收成它，再缩回圆盘）
 */
export const beginOpen = (from: TransitionRect, to: TransitionRect, circle: TransitionRect) => {
  // 上次关闭会把页面留在屏外，这里复位（不放在关闭回调里，否则会看到页面弹回原位一帧）
  dragY.setValue(0)
  state = { phase: 'opening', from, to, circle }
  progressAnim.setValue(0)
  emit()
  Animated.timing(progressAnim, {
    toValue: 1,
    duration: 460,
    // 起步快、收尾慢，接近 macOS Dock 的观感；不要用 spring，回弹会晃
    easing: Easing.bezier(0.22, 0.9, 0.28, 1),
    // 位置和尺寸都要插值，没法走 native driver
    useNativeDriver: false,
  }).start(() => {
    // 不检查 finished：动画被打断时也必须把 phase 收回去，否则转场层会一直盖着
    state = { ...state, phase: 'idle' }
    emit()
  })
}

/**
 * 下滑开始接管封面。返回 false 表示这次不做共享元素（没有起点记录 / 已经在转场中）。
 */
export const beginClose = () => {
  if (state.phase !== 'idle' || !state.from || !state.to) return false
  state = { ...state, phase: 'closing' }
  progressAnim.setValue(1)
  emit()
  return true
}

/** 手势驱动：p 是「展开程度」，手指往下拉时 1 → 0 */
export const setCloseProgress = (p: number) => {
  if (state.phase !== 'closing') return
  progressAnim.setValue(Math.max(0, Math.min(1, p)))
}

/** 松手没到阈值：弹回展开态 */
export const cancelClose = () => {
  Animated.spring(progressAnim, {
    toValue: 1,
    friction: 9,
    tension: 80,
    useNativeDriver: false,
  }).start(() => {
    state = { ...state, phase: 'idle' }
    emit()
  })
}

/** 达到关闭条件：缩回圆盘，动画结束后回调（由调用方切回首页） */
export const finishClose = (onDone: () => void) => {
  Animated.timing(progressAnim, {
    toValue: 0,
    duration: 300,
    easing: Easing.bezier(0.4, 0, 0.55, 1),
    useNativeDriver: false,
  }).start(() => {
    /*
      顺序很关键：
      1. 先切页（onDone）—— 播放器页随之卸载；
      2. 下一帧再收掉转场层。
      反过来的话，emit 会让 Player 的 Stage 先显示出来（封面闪回原位），
      再切页，用户看到的就是「底部一块封面色 + 闪一下」。
      多留一帧还能把 PagerView 切页那一下盖住。
    */
    onDone()
    requestAnimationFrame(() => {
      state = { phase: 'idle', from: state.from, to: state.to, circle: state.circle }
      emit()
    })
  })
}

/** 没有走共享元素时的清理（例如直接点返回键） */
export const resetTransition = () => {
  if (state.phase === 'idle') return
  state = { phase: 'idle', from: state.from, to: state.to, circle: state.circle }
  progressAnim.setValue(1)
  emit()
}
