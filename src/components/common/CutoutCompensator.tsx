import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'

import { useHorizontalMode, useWindowSize } from '@/utils/hooks'

/**
 * 挖孔（cutout）补偿。
 *
 * 横屏时前置挖孔在屏幕左侧，原生层会把整个屏幕容器往右推 96px，
 * 表现就是左边一条窗口底色的白边 —— 播放器那种深色页尤其明显。
 *
 * 试过但都盖不住这个 inset：
 *   - 主题里的 android:windowLayoutInDisplayCutoutMode=always / shortEdges
 *   - MainActivity 里 WindowCompat.setDecorFitsSystemWindows(false)
 *   - RNN 的 layout.fitSystemWindows = false
 * 所以这里量一次「窗口宽 - 实际布局宽」，用负 margin 把它顶回去。
 * 只在第一次量到的差值 > 4 时生效，转屏后重新量。
 */
export default ({ children }: { children: ReactNode }) => {
  const isHorizontalMode = useHorizontalMode()
  const { width: windowWidth } = useWindowSize()
  const [inset, setInset] = useState(0)
  const compensatedRef = useRef(0)

  // 转屏后先把补偿归零，下一帧拿到的是未补偿的宽度
  useEffect(() => {
    compensatedRef.current = 0
    setInset(0)
  }, [isHorizontalMode])

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    if (compensatedRef.current > 0) return
    const measured = e.nativeEvent.layout.width
    const diff = Math.round(windowWidth - measured)
    if (diff > 4) {
      compensatedRef.current = diff
      setInset(diff)
    }
  }, [windowWidth])

  return (
    <View style={{ flex: 1, marginLeft: -inset }} onLayout={handleLayout}>
      {children}
    </View>
  )
}
