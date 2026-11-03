import type { View } from 'react-native'

import { setNavActiveId } from '@/core/common'
import commonState from '@/store/common/state'
import { isHorizontalMode } from '@/utils/tools'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { COVER_H_RATIO, COVER_TOP_RATIO } from '@/screens/Home/Views/Player/Stage'
import {
  beginOpen,
  canTransition,
  clearTransition,
  getOriginNavId,
  getTransitionState,
  playCloseFromOrigin,
  type TransitionRect,
} from './playerTransition'

/**
 * 「打开 / 关闭播放器页」的公共入口。
 *
 * 竖屏有多个入口都会打开播放器：
 *   1. 胶囊导航右侧的专辑圆盘（BottomNav，起点是 48dp 正圆）；
 *   2. 收藏页 / 排行榜 / 歌单详情底部的迷你播放条（PlayerBar，起点是条上的圆盘）；
 *   3. Home 底部迷你播放器（MiniPlayer，横屏布局下才有）；
 *   4. 收藏页自己的迷你播放器（Favorites）。
 * 目标都是同一个「播放器页竖屏封面矩形」，中间都要经过同一个「大圆」，
 * 所以测量起点之后的算法必须完全一致。
 *
 * 打开时顺手记下两件事，关闭（左上角收起 / 返回键 / 下滑手势）时要用：
 *   - 本次进入前所在的 Tab（关闭后切回它，而不是固定回首页）；
 *   - 收拢终点：一般就是起点矩形；跨 RNN 页面（歌单详情 / 歌单）打开时，
 *     那个页面会被 pop 掉，起点控件随之消失，于是收拢到首页胶囊的圆盘位置。
 */

/** 起点测量：把控件在屏幕上的位置量出来回调；量不到就回调 null */
export type StartRectGetter = (done: (rect: TransitionRect | null) => void) => void

/** 播放器竖屏封面矩形 + 转场中间态的大圆 */
export const getPlayerCoverGeometry = (winW: number, winH: number) => {
  const coverW = winW
  const coverH = winH * COVER_H_RATIO
  const coverTop = winH * COVER_TOP_RATIO
  // 大圆直径取封面宽度，圆心对齐封面区域中心
  const circleD = coverW
  return {
    target: { x: 0, y: coverTop, width: coverW, height: coverH },
    circle: {
      x: (coverW - circleD) / 2,
      y: coverTop + coverH / 2 - circleD / 2,
      width: circleD,
      height: circleD,
    },
  }
}

/**
 * 把控件量成共享元素起点矩形。
 *
 * 飞行封面在转场层里是按「正圆」起手的（圆角半径 = 宽度 / 2），
 * 所以起点统一取控件中心的正方形，边长默认 min(宽, 高)，
 * 也可以由调用方指定（圆盘外面套了一圈 54dp 的光环，实际圆盘只有 48dp）。
 */
export const measureStartRect = (
  node: View | null,
  done: (rect: TransitionRect | null) => void,
  /** 指定正方形边长（不传就取 min(宽, 高)），超过控件尺寸时按控件尺寸收 */
  size?: number,
) => {
  if (!node) {
    done(null)
    return
  }
  node.measureInWindow((x, y, w, h) => {
    // 控件还没布局（宽高为 0）时量不出东西，交回调用方走 fallback
    if (!(w > 0) || !(h > 0)) {
      done(null)
      return
    }
    const d = Math.min(size ?? Math.min(w, h), w, h)
    done({
      x: x + (w - d) / 2,
      y: y + (h - d) / 2,
      width: d,
      height: d,
    })
  })
}

/*
  首页底部胶囊圆盘的节点登记。

  歌单详情 / 歌单是 RNN 独立屏，从它们的 PlayerBar 打开播放器时要先 pop 回首页；
  等关闭播放器时那个 PlayerBar 已经不存在了，收拢终点应该是首页胶囊的圆盘。
  但胶囊在播放器页是不挂载的（Vertical/index 里隐藏了），关闭时量不到 ——
  所以在打开播放器之前（首页还在、胶囊还挂着）把节点登记好，需要时先量出来。
*/
let discNode: View | null = null
let discSize = 0

export const registerDiscNode = (node: View | null, size = 0) => {
  discNode = node
  discSize = size
}

/** 量首页胶囊圆盘的屏幕矩形（没有登记或量不到就回调 null） */
export const measureDiscRect = (done: (rect: TransitionRect | null) => void) => {
  if (!discNode) {
    done(null)
    return
  }
  measureStartRect(discNode, done, discSize || undefined)
}

/** 播放器页在当前布局下能不能做共享元素（转场层只在竖屏布局挂载，见 Home/index.tsx） */
const isTransitionLayerMounted = (winW: number, winH: number) => (
  winW > 0 && winH > 0 && !isHorizontalMode(winW, winH)
)

/**
 * 打开播放器页：量起点 → 记录转场 → 切页。
 *
 * @param measureStart 量起点矩形（一般直接用 measureStartRect）。
 *   不传、量失败、控件还没布局时都直接切页 —— 转场只是锦上添花，不能阻塞功能。
 */
export const openPlayerWithTransition = (measureStart?: StartRectGetter) => {
  const { width: winW, height: winH } = windowSizeTools.getSize()
  const originNavId = commonState.navActiveId
  if (!measureStart || !isTransitionLayerMounted(winW, winH)) {
    clearTransition()
    setNavActiveId('nav_player')
    return
  }

  const { target, circle } = getPlayerCoverGeometry(winW, winH)
  const finish = (from: TransitionRect | null) => {
    if (from) beginOpen(from, target, circle, { originNavId })
    else clearTransition()
    setNavActiveId('nav_player')
  }
  try {
    measureStart(finish)
  } catch {
    // measureInWindow 在极端情况下（控件已卸载）可能抛错，退化成直接切页
    finish(null)
  }
}

/**
 * 从「别的页面（歌单详情 / 歌单 / 排行榜）的底部迷你播放条」打开播放器页。
 *
 * 这些页面可能是 RNN 压栈的独立屏（SonglistDetail / SongListScreen），点迷你播放条
 * 时必须先 pop 回首页才有转场层；而飞行封面的起点要在页面还在的时候量好 ——
 * 所以顺序是：先量起点 → pop 回首页 → 等 pop 动画结束再 beginOpen + 切页。
 * 排行榜这类就在首页内部的页面传 isHome=true，省掉等待直接起动画。
 *
 * @param measureStart 量迷你播放条封面的屏幕矩形（页面还在时调用）
 * @param beforeSwitch 切换前的动作（一般是 popTo 首页；不传就什么都不做）
 * @param waitPop 要不要等 pop 动画（RNN 默认 ~140ms）
 * @param preferDiscOrigin 收拢终点是否改用首页胶囊圆盘（跨 RNN 页面打开时传 true）
 */
export const openPlayerFromBar = (
  measureStart: StartRectGetter,
  beforeSwitch?: () => void,
  waitPop = true,
  preferDiscOrigin = false,
) => {
  const { width: winW, height: winH } = windowSizeTools.getSize()
  const originNavId = commonState.navActiveId
  const switchNow = () => {
    clearTransition()
    beforeSwitch?.()
    setNavActiveId('nav_player')
  }
  if (!isTransitionLayerMounted(winW, winH)) {
    switchNow()
    return
  }

  const { target, circle } = getPlayerCoverGeometry(winW, winH)
  const run = (from: TransitionRect | null, closeTo: TransitionRect | null) => {
    beforeSwitch?.()
    const fire = () => {
      if (from) beginOpen(from, target, circle, { originNavId, closeTo })
      else clearTransition()
      setNavActiveId('nav_player')
    }
    if (waitPop) setTimeout(fire, 140)
    else fire()
  }
  const start = (from: TransitionRect | null) => {
    if (!from) {
      run(null, null)
      return
    }
    if (!preferDiscOrigin) {
      run(from, null)
      return
    }
    // 页面马上要被 pop 掉：先量首页胶囊圆盘（它还在下面挂着），作为关闭时的收拢终点
    measureDiscRect(closeTo => { run(from, closeTo) })
  }
  try {
    measureStart(start)
  } catch {
    switchNow()
  }
}

/**
 * 关闭播放器页：飞行封面从播放器封面收回到本次进入时的起点，再切回原 Tab。
 *
 * @param beforeSwitch 切页前的回调（Player 用来把整页下滑的位移补满）
 * @returns 有没有真的走收拢动画（false = 直接切页）
 */
export const closePlayerWithTransition = (beforeSwitch?: () => void) => {
  const { width: winW, height: winH } = windowSizeTools.getSize()
  const finish = () => {
    beforeSwitch?.()
    setNavActiveId(getOriginNavId() ?? 'nav_home')
  }
  if (!isTransitionLayerMounted(winW, winH) || !canTransition()) {
    clearTransition()
    finish()
    return false
  }
  if (!playCloseFromOrigin(finish)) {
    // 正在打开 / 正在关闭：别在这里再插一段动画，清掉状态直接切页
    clearTransition()
    finish()
    return false
  }
  return true
}

/**
 * 当前能不能做「播放器 → 起点」的收拢动画。
 * 调用方（播放器页）用它决定要不要同时播整页下滑。
 */
export const canPlayCloseTransition = () => {
  const { width, height } = windowSizeTools.getSize()
  return isTransitionLayerMounted(width, height) &&
    canTransition() &&
    // 打开动画还没跑完就别插关闭动画（会两段动画打架），退回整页下滑
    getTransitionState().phase === 'idle'
}
