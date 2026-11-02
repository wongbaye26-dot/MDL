import { memo, useCallback, useRef, useState } from 'react'
import { View, type GestureResponderEvent } from 'react-native'

/**
 * 飞牛的进度条：6dp 高、两端全圆角、没有拖动圆点（thumb）。
 * @react-native-community/slider 在 Android 上一定带 thumb，所以自己画一条。
 */
export default memo(({
  value,
  max,
  height = 6,
  fillColor = '#FFFFFF',
  trackColor = 'rgba(255,255,255,0.34)',
  hitSlopY = 16,
  onSeek,
  onPreview,
  onZone,
}: {
  value: number
  max: number
  height?: number
  fillColor?: string
  trackColor?: string
  hitSlopY?: number
  /** 松手后提交 */
  onSeek: (time: number) => void
  /** 拖动过程中回传，用于实时更新时间文字 */
  onPreview?: (time: number) => void
  /** 上报自己在屏幕上的 y 区间（播放器要用它把这块区域从下滑手势里排除） */
  onZone?: (top: number, bottom: number) => void
}) => {
  const widthRef = useRef(0)
  const boxRef = useRef<View>(null)
  const [dragRatio, setDragRatio] = useState<number | null>(null)

  const ratioOf = useCallback((e: GestureResponderEvent) => {
    const w = widthRef.current
    if (w <= 0) return 0
    return Math.max(0, Math.min(1, e.nativeEvent.locationX / w))
  }, [])

  const emit = useCallback((r: number, commit: boolean) => {
    const time = r * (max || 0)
    if (commit) {
      setDragRatio(null)
      onSeek(time)
    } else {
      setDragRatio(r)
      onPreview?.(time)
    }
  }, [max, onSeek, onPreview])

  const shown = dragRatio ?? (max > 0 ? Math.max(0, Math.min(1, value / max)) : 0)

  return (
    <View
      style={{ width: '100%', height: height + hitSlopY * 2, justifyContent: 'center' }}
      ref={boxRef}
      onLayout={e => {
        widthRef.current = e.nativeEvent.layout.width
        const node = boxRef.current
        if (!node) return
        node.measureInWindow((_x, y, _w, h) => { onZone?.(y, y + h) })
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={e => { emit(ratioOf(e), false) }}
      onResponderMove={e => { emit(ratioOf(e), false) }}
      onResponderRelease={e => { emit(ratioOf(e), true) }}
      onResponderTerminate={() => { setDragRatio(null) }}
    >
      <View style={{ height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' }}>
        <View style={{ height, borderRadius: height / 2, width: `${shown * 100}%`, backgroundColor: fillColor }} />
      </View>
    </View>
  )
})
