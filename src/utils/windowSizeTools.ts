import { Dimensions, StatusBar } from 'react-native'
import {
  emptyWindowInsets,
  getWindowInsets,
  getWindowSize as getWindowSizeRaw,
  onWindowSizeChange,
  type EdgeInsets,
  type WindowInsetsInfo,
  type WindowMetrics,
} from './nativeModules/utils'
import { log } from './log'

export type SizeHandler = (size: { width: number, height: number }) => void
export type InsetsHandler = (insets: WindowInsetsInfo) => void

export const getWindowSize = async() => {
  return getWindowSizeRaw().then((size) => {
    const scale = Dimensions.get('window').scale
    size.width = size.width / scale
    size.height = size.height / scale
    return size
  })
}

const sameEdge = (a: EdgeInsets, b: EdgeInsets) => (
  a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right
)

const sameInsets = (a: WindowInsetsInfo, b: WindowInsetsInfo) => (
  a.density === b.density &&
  a.isInMultiWindowMode === b.isInMultiWindowMode &&
  sameEdge(a.statusBars, b.statusBars) &&
  sameEdge(a.navigationBars, b.navigationBars) &&
  sameEdge(a.systemBars, b.systemBars) &&
  sameEdge(a.cutout, b.cutout) &&
  sameEdge(a.ime, b.ime)
)

/**
 * 窗口尺寸 / insets 工具。
 *
 * 窗口尺寸单位统一为 dp（与 RN 的 Dimensions 一致），insets 为 px（用 insets.density 换算）。
 *
 * 数据来源有三路，后写的覆盖先写的：
 *  1. Dimensions.change：旋转、部分 ROM 的分屏会触发；
 *  2. 原生 screen-size-changed：decor 布局 / MainActivity insets 回调推送，
 *     Android 15/16 强制 edge-to-edge 后自由窗口（分屏/小窗）拖动时只有这一路可靠；
 *  3. init 时直接查原生窗口尺寸（首帧兜底）。
 */
export const windowSizeTools = {
  size: {
    width: 0,
    height: 0,
  },
  /** 上一次读到的系统栏 insets（px） */
  insets: emptyWindowInsets(),
  listeners: [] as SizeHandler[],
  insetsListeners: [] as InsetsHandler[],
  /** init 注册的监听，便于理论上卸载 */
  unsubscribers: [] as Array<() => void>,
  getSize() {
    return this.size
  },
  getInsets() {
    return this.insets
  },
  onSizeChanged(handler: SizeHandler) {
    this.listeners.push(handler)

    return () => {
      this.listeners.splice(this.listeners.indexOf(handler), 1)
    }
  },
  onInsetsChanged(handler: InsetsHandler) {
    this.insetsListeners.push(handler)

    return () => {
      this.insetsListeners.splice(this.insetsListeners.indexOf(handler), 1)
    }
  },
  /** 更新窗口尺寸（dp）。值没变就不通知，避免布局/渲染循环 */
  setWindowSize(width: number, height: number) {
    const next = {
      width: Math.round(width),
      height: Math.round(height),
    }
    if (!next.width || !next.height) return
    if (next.width === this.size.width && next.height === this.size.height) return
    if (this.isKeyboardTransientResize(next)) {
      log.info(`[windowSizeTools] ignore keyboard transient size ${next.width}x${next.height} (keep ${this.size.width}x${this.size.height})`)
      return
    }
    this.size = next
    for (const handler of this.listeners) handler(next)
  },
  /**
   * 判断这次尺寸变化是不是输入法弹起造成的临时压缩。
   *
   * 为什么必须识别：Android 15/16 强制 edge-to-edge 后，键盘弹出时
   * `Dimensions` / 布局高度 / 原生可见区域都可能临时变小（实测 411x891 → 411x205dp）。
   * 窗口形态（全屏/分屏/横竖屏）并没有变，如果照单全收，`isHorizontalMode(411,205)` 会变成
   * `true`，Home 页会从竖屏布局切到横屏布局并**卸载整个竖屏树** ——
   * 表现就是「点一下搜索框，搜索页直接消失」。
   *
   * 判据（三重保险）：
   *  1. 原生 insets 里 ime.bottom > 0（最可靠）；
   *  2. 全屏模式（非分屏/小窗）下宽度不变、高度骤减到 <70% 且总高 < 500dp（键盘弹起瞬间 insets 还没到）；
   *  3. 分屏/小窗下的尺寸变化一律认为是真的（用户就是在拖窗口，必须跟随）。
   */
  isKeyboardTransientResize(next: { width: number, height: number }) {
    const prev = this.size
    if (!prev.width || !prev.height) return false
    if (this.insets.ime.bottom > 0) return true
    if (this.insets.isInMultiWindowMode) return false
    // 全屏下旋转会同时改变宽高，而键盘只会压高度
    if (next.width !== prev.width) return false
    return next.height < prev.height * 0.7 && next.height < 500
  },
  setInsets(insets: WindowInsetsInfo) {
    if (sameInsets(this.insets, insets)) return
    this.insets = insets
    for (const handler of this.insetsListeners) handler(insets)
  },
  /** 应用原生 screen-size-changed 推来的 metrics（dp 尺寸 + px insets） */
  applyWindowMetrics(metrics: WindowMetrics) {
    this.setInsets(metrics)
    this.setWindowSize(metrics.width, metrics.height)
  },
  async init() {
    const dimensionsSubscription = Dimensions.addEventListener('change', ({ window }) => {
      // 分屏、小窗、折叠屏切换都会走这里；用 window 而不是 screen，拿到的就是可用区域。
      // 注意：Android 15/16 自由窗口拖动时 RN 0.73 不一定刷新 Dimensions，
      // 真正的尺寸以原生 screen-size-changed 为准（下面订阅）。
      const next = {
        width: Math.round(window.width),
        height: Math.round(window.height) + (StatusBar.currentHeight ?? 0),
      }
      if (!next.width) return
      this.setWindowSize(next.width, next.height)
      // 导航栏模式（手势 ↔ 三键）可能一起变，顺手刷新 insets
      void getWindowInsets().then((insets) => { this.setInsets(insets) })
    })
    this.unsubscribers.push(() => { dimensionsSubscription.remove() })

    this.unsubscribers.push(onWindowSizeChange((metrics) => {
      this.applyWindowMetrics(metrics)
    }))

    const [size, insets] = await Promise.all([
      getWindowSize().catch(() => ({ width: 0, height: 0 })),
      getWindowInsets(),
    ])
    this.setInsets(insets)

    if (size.width > 0 && size.height > 0) {
      // getWindowSize 返回的是「可见区域」（不含状态栏/导航栏），加上状态栏高度后
      // 与 SizeView 量到的 RN 根视图高度语义一致（窗口高度含状态栏、不含导航栏）
      this.size = {
        width: Math.round(size.width),
        height: Math.round(size.height) + (StatusBar.currentHeight ?? 0),
      }
    } else {
      const window = Dimensions.get('window')
      this.size = {
        width: Math.round(window.width),
        height: Math.round(window.height) + (StatusBar.currentHeight ?? 0),
      }
    }
    return size
  },
}
