import { useEffect, useState } from 'react'

/**
 * 整屏浮层的可见性锁。
 *
 * 横屏时左侧导航是浮在内容之上的，而整屏子页（排行榜 / 歌单广场 / 收藏 / 设置子页）
 * 渲染在内容区内部 —— 无论 zIndex 怎么调，导航都会盖在子页上面，
 * 看起来就是「子页没有全屏」。
 *
 * 所以子页挂载时在这里打一把锁，外壳（Horizontal/index）据此把导航收起来，
 * 子页关掉后自动恢复。用一个模块级计数 + 订阅，避免为此引入 context 或全局 state。
 */
let lockCount = 0
const listeners = new Set<() => void>()

const notify = () => { listeners.forEach(fn => { fn() }) }

/**
 * 子页挂载期间调用，卸载自动释放。
 * @param active 传 false 时不占锁 —— 有些浮层组件是常驻挂载、只切渲染内容的，
 *               直接用挂载/卸载当开关会把它永久锁住。
 */
export const useOverlayLock = (active = true) => {
  useEffect(() => {
    if (!active) return
    lockCount += 1
    notify()
    return () => {
      lockCount -= 1
      notify()
    }
  }, [active])
}

/** 当前是否有整屏子页打开 */
export const useOverlayVisible = () => {
  const [visible, setVisible] = useState(lockCount > 0)

  useEffect(() => {
    const update = () => { setVisible(lockCount > 0) }
    listeners.add(update)
    update()
    return () => { listeners.delete(update) }
  }, [])

  return visible
}
