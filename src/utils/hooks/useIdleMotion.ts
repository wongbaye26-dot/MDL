import { useEffect, useState } from 'react'

/**
 * 用户是否仍在「活跃」状态（最近 idleMs 内有过触摸/滚动）。
 *
 * 首页大卡片上的常驻装饰动效（跳动柱状 / 黑胶自转 / 爱心 / 波纹）是纯装饰，
 * 用户长时间不操作时继续 60fps 播放会白白耗电（实测 RenderThread 可占 ~45%）。
 * 这里做一个全局空闲判定：超过 idleMs 没有交互就停掉装饰动效，用户一碰屏幕立刻恢复。
 *
 * 交互时间戳由 `global.lx.lastUserActivityAt` 维护（Home 根节点 onTouchStart 更新）。
 */
const DEFAULT_IDLE_MS = 8000

export default (idleMs = DEFAULT_IDLE_MS): boolean => {
  const [active, setActive] = useState(() => Date.now() - (global.lx.lastUserActivityAt ?? 0) < idleMs)

  useEffect(() => {
    const tick = () => {
      setActive(Date.now() - (global.lx.lastUserActivityAt ?? 0) < idleMs)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => { clearInterval(timer) }
  }, [idleMs])

  return active
}
