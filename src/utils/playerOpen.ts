import type { View } from 'react-native'

import { setNavActiveId } from '@/core/common'
import { isHorizontalMode } from '@/utils/tools'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { COVER_H_RATIO, COVER_TOP_RATIO } from '@/screens/Home/Views/Player/Stage'
import { beginOpen, type TransitionRect } from './playerTransition'

/**
 * 「从底部封面打开播放器页」的公共入口。
 *
 * 竖屏底部有两个入口都会打开播放器：
 *   1. 胶囊导航右侧的专辑圆盘（BottomNav，起点是 48dp 正圆）；
 *   2. 迷你播放器左侧的封面（MiniPlayer，起点是 38dp 的小圆角方块）。
 * 两处的目标都是同一个「播放器页竖屏封面矩形」，中间都要经过同一个「大圆」，
 * 所以测量起点之后的算法必须完全一致 —— 以前这段代码只写在 BottomNav 里，
 * MiniPlayer 直接 setNavActiveId 切页（没有动画），这里抽出来两边共用。
 *
 * 几何算法和 BottomNav 原来那套逐字一致（窗口宽高 × Stage 的封面比例），
 * 常量直接 import Stage，避免两处各写一份数值后慢慢漂移。
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

/**
 * 打开播放器页：量起点 → 记录转场 → 切页。
 *
 * @param measureStart 量起点矩形（一般直接用 measureStartRect）。
 *   不传、量失败、控件还没布局时都直接切页 —— 转场只是锦上添花，不能阻塞功能。
 */
export const openPlayerWithTransition = (measureStart?: StartRectGetter) => {
  const { width: winW, height: winH } = windowSizeTools.getSize()
  /*
    转场层（Vertical/PlayerTransition）只在竖屏布局挂载，见 Home/index.tsx：
      {isHorizontalMode ? null : <PlayerTransition />}
    横屏布局没有层可画，硬起动画只会让播放器自己的封面空等 460ms（转场期间封面是隐藏的），
    所以这里直接切页。等以后横屏也挂上转场层，把这个判断去掉即可。
  */
  if (!measureStart || !(winW > 0) || !(winH > 0) || isHorizontalMode(winW, winH)) {
    setNavActiveId('nav_player')
    return
  }

  const { target, circle } = getPlayerCoverGeometry(winW, winH)
  const finish = (from: TransitionRect | null) => {
    if (from) beginOpen(from, target, circle)
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
 */
export const openPlayerFromBar = (
  measureStart: StartRectGetter,
  beforeSwitch?: () => void,
  waitPop = true,
) => {
  const { width: winW, height: winH } = windowSizeTools.getSize()
  const notAnimatable = !(winW > 0) || !(winH > 0) || isHorizontalMode(winW, winH)
  const switchNow = () => {
    beforeSwitch?.()
    setNavActiveId('nav_player')
  }
  if (notAnimatable) {
    switchNow()
    return
  }

  const { target, circle } = getPlayerCoverGeometry(winW, winH)
  const start = (from: TransitionRect | null) => {
    beforeSwitch?.()
    const run = () => {
      if (from) beginOpen(from, target, circle)
      setNavActiveId('nav_player')
    }
    if (waitPop) setTimeout(run, 140)
    else run()
  }
  try {
    measureStart(start)
  } catch {
    switchNow()
  }
}
