import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

import { useSettingValue } from '@/store/setting/hook'

/**
 * 是否应该减少动态效果。
 *
 * 两个来源取并集：
 * 1. 应用内设置 `common.reduceMotion`（设置 → 外观 → 减少动态效果）；
 * 2. 系统无障碍「移除动画」（Android 12+ / iOS Reduce Motion）。
 *
 * 用法：`const reduced = useReducedMotion()`，然后把时长交给 `motionDuration()`，
 * 长驻循环动画用 `motionEnabled()` 直接停掉。
 */
export default (): boolean => {
  const setting = useSettingValue('common.reduceMotion')
  const [system, setSystem] = useState(false)

  useEffect(() => {
    let alive = true
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (alive) setSystem(enabled)
    }).catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      setSystem(enabled)
    })
    return () => {
      alive = false
      subscription.remove()
    }
  }, [])

  return !!setting || system
}
