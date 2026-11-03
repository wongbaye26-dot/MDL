import { Animated, Easing } from 'react-native'

import type commonState from '@/store/common/state'

/**
 * 播放器封面共享元素转场。
 *
 * 底部胶囊的圆盘（圆形 48dp）、迷你播放器封面（圆角小方块）和播放器封面（全宽矩形）
 * 是同一个封面，这里用一份「展开程度」progress 把两者连起来：
 *   progress = 1 → 封面在播放器里的位置和尺寸
 *   progress = 0 → 封面在起点（圆盘 / 迷你播放器封面）里的位置和尺寸
 *
 * 打开时 progress 由 timing 从 0 跑到 1；下滑时由手势直接 setValue（真正跟手），
 * 松手没到阈值就 spring 回 1，到阈值就 timing 到 0 再切回原 Tab。
 * 点返回键 / 左上角收起时走 playCloseFromOrigin：同样是 1 → 0 的收拢动画，
 * 只是终点用 originCloseTo（跨 RNN 页面时起点可能已经不在屏幕上了，要换成首页的圆盘）。
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
  /** 起点（圆盘 / 迷你播放器封面 / PlayerBar 圆盘）的屏幕矩形 */
  from: TransitionRect | null
  /** 播放器封面矩形（展开态） */
  to: TransitionRect | null
  /** 中间态的「大圆」：下拉一开始封面先收成这个大圆，再一路缩回起点 */
  circle: TransitionRect | null
  /** 本次进入播放器前所在的 Tab：关闭时切回它（不再固定回首页） */
  originNavId: typeof commonState.navActiveId | null
  /**
   * 非手势关闭（左上角收起 / 返回键）时收拢到的矩形。
   * 一般是 from；跨 RNN 页面打开时是从别的页面点进来的，那个页面已经被 pop 掉了，
   * 这时要收回到首页底部的胶囊圆盘（打开前先量好），否则会缩到一块没有控件的空白处。
   */
  originCloseTo: TransitionRect | null
  /** 本次关闭实际用的终点（手势关闭时为空 = 用 from） */
  closingTo: TransitionRect | null
}

/**
 * 最近一次停留的「非播放器」Tab。
 * 横屏左侧导航（Aside）这类直接 setNavActiveId('nav_player') 的入口没走 open helper、
 * 记不到 origin，关闭时用它兜底，至少能回到进入前那个 Tab。
 */
let lastTab: typeof commonState.navActiveId | null = null

let state: TransitionState = {
  phase: 'idle',
  from: null,
  to: null,
  circle: null,
  originNavId: null,
  originCloseTo: null,
  closingTo: null,
}
const listeners = new Set<() => void>()

/** 0 = 收起（起点），1 = 展开（播放器封面） */
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

/** 有没有「从某个封面打开」的记录 —— 没有就不做共享元素，直接用原来的切页 */
export const canTransition = () => state.from != null && state.to != null

/** 记录当前停留的 Tab（播放器页不参与：从播放器切回来时不能把 origin 改成 nav_player） */
export const rememberActiveTab = (id: typeof commonState.navActiveId) => {
  if (id !== 'nav_player') lastTab = id
}

/** 本次进入播放器前所在的 Tab（关闭时切回它；走直连入口时用最近停留的 Tab 兜底） */
export const getOriginNavId = () => state.originNavId ?? lastTab

/**
 * 记录一次「从封面打开」，并开始放大动画。
 * @param circle 中间态的大圆（收起时封面先收成它，再缩回起点）
 * @param options.originNavId 进入前的 Tab，关闭时切回它
 * @param options.closeTo 非手势关闭时的收拢终点（默认 from）
 */
export const beginOpen = (
  from: TransitionRect,
  to: TransitionRect,
  circle: TransitionRect,
  options?: {
    originNavId?: typeof commonState.navActiveId | null
    closeTo?: TransitionRect | null
  },
) => {
  // 上次关闭会把页面留在屏外，这里复位（不放在关闭回调里，否则会看到页面弹回原位一帧）
  dragY.setValue(0)
  state = {
    phase: 'opening',
    from,
    to,
    circle,
    originNavId: options?.originNavId ?? null,
    originCloseTo: options?.closeTo ?? null,
    closingTo: null,
  }
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
  /*
    手势关闭从播放器封面出发、缩回本次进入的起点。
    起点如果是「跨 RNN 页面点进来的播放条」，那个控件已经随页面被 pop 掉了 ——
    用 originCloseTo（首页圆盘）收，p=1 时和打开时的终点完全重合，不会跳。
  */
  state = { ...state, phase: 'closing', closingTo: state.originCloseTo ?? state.from }
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
    state = { ...state, phase: 'idle', closingTo: null }
    emit()
  })
}

/** 达到关闭条件：缩回起点，动画结束后回调（由调用方切回原 Tab） */
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
      state = { ...state, phase: 'idle', closingTo: null }
      emit()
    })
  })
}

/**
 * 非手势关闭（左上角 chevron / 返回键）：直接播 1 → 0 的收拢动画。
 * 返回 false 表示没有可用的转场（调用方直接切页）。
 */
export const playCloseFromOrigin = (onDone: () => void) => {
  if (state.phase !== 'idle' || !state.from || !state.to) return false
  state = {
    ...state,
    phase: 'closing',
    // 跨 RNN 页面进来的，起点控件已经随页面被 pop 掉，收回到打开前量好的首页圆盘
    closingTo: state.originCloseTo ?? state.from,
  }
  progressAnim.setValue(1)
  emit()
  finishClose(onDone)
  return true
}

/** 没有走共享元素时的清理（例如直接点返回键） */
export const resetTransition = () => {
  if (state.phase === 'idle') return
  state = { ...state, phase: 'idle', closingTo: null }
  progressAnim.setValue(1)
  emit()
}

/**
 * 清掉整份转场记录（起点 / 终点 / 原 Tab）。
 *
 * 打开时如果没能做共享元素（横屏、量不到起点），必须调用它：
 * 否则上一次的旧起点会留在 state 里，关闭时又照着它飞一遍，位置全是错的。
 */
export const clearTransition = () => {
  // 上一次关闭可能把页面留在屏外（dragY 在底部），清记录时一起复位，
  // 否则下一次直接切页（没有动画的入口）会先看到一帧「播放器页在屏幕下方」。
  dragY.setValue(0)
  state = {
    phase: 'idle',
    from: null,
    to: null,
    circle: null,
    originNavId: null,
    originCloseTo: null,
    closingTo: null,
  }
  progressAnim.setValue(1)
  emit()
}
