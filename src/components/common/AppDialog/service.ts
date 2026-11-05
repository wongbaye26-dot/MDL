/**
 * App 内统一弹窗（Material You 风格）的全局调度。
 *
 * 背景：设置页 / 音乐工具里此前大量使用 `Alert.alert`（Android 原生灰色弹窗），
 * 与 App 的 Material You 卡片语言完全是两个世界。这里提供一个全局弹窗队列：
 *  - `tools.ts` 的 confirmDialog / tipDialog 在宿主可用时优先走它，不可用时回退原生 Alert（行为不变）；
 *  - 宿主 `AppDialogHost` 挂在 Home 根节点（常驻），一个实例覆盖所有页面；
 *  - 队列串行，避免两个弹窗叠在一起；宿主卸载时把未决弹窗按取消处理，避免 Promise 永久挂起。
 */

export interface AppDialogAction {
  text: string
  /** primary=主色实心；danger=危险实心；cancel/default=次级按钮 */
  style?: 'default' | 'cancel' | 'primary' | 'danger'
  onPress?: () => void
}

export interface AppDialogOptions {
  title?: string
  message: string
  actions: AppDialogAction[]
  /** 点击遮罩 / 返回键是否可关闭（默认 true）；关闭走 onDismiss */
  bgClose?: boolean
  /** 遮罩 / 返回键关闭时的回调（用于 resolve(false) 之类） */
  onDismiss?: () => void
}

const queue: AppDialogOptions[] = []
const listeners = new Set<(options: AppDialogOptions | null) => void>()
let hostCount = 0

const emit = () => {
  const current = queue[0] ?? null
  for (const listener of listeners) listener(current)
}

/** 宿主挂载 / 卸载；返回注销函数 */
export const registerAppDialogHost = () => {
  hostCount++
  emit()
  return () => {
    hostCount = Math.max(0, hostCount - 1)
    // 宿主没了：把还没处理的弹窗按取消处理，保证调用方的 Promise 都有结果
    while (queue.length) {
      queue.shift()?.onDismiss?.()
    }
    emit()
  }
}

export const isAppDialogAvailable = () => hostCount > 0

export const subscribeAppDialog = (listener: (options: AppDialogOptions | null) => void) => {
  listeners.add(listener)
  listener(queue[0] ?? null)
  return () => { listeners.delete(listener) }
}

/** 入队一个弹窗；宿主不可用时返回 false（调用方回退原生实现） */
export const showAppDialog = (options: AppDialogOptions): boolean => {
  if (hostCount <= 0) return false
  queue.push(options)
  if (queue.length === 1) emit()
  return true
}

/** 用户点了第 index 个按钮 */
export const selectAppDialogAction = (index: number) => {
  const item = queue.shift()
  if (!item) return
  emit()
  item.actions[index]?.onPress?.()
}

/** 遮罩 / 返回键关闭 */
export const dismissAppDialog = () => {
  const item = queue.shift()
  if (!item) return
  emit()
  item.onDismiss?.()
}
