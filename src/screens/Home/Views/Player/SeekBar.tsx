import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, View, type GestureResponderEvent } from 'react-native'

import { MotionSpring } from '@/theme/motion'
import { useReducedMotion } from '@/utils/hooks'
import { formatPlayTime2 } from '@/utils/common'
import { createStyle } from '@/utils/tools'

/**
 * 弹性进度条（对标 ReactBits Elastic Slider 的手感）。
 *
 * 与旧版的区别：
 * - 有可拖动的 thumb，拖动时放大，给出「抓住了」的反馈；
 * - 越界拖动不再是死区：thumb 按 tanh 曲线拉伸（rubber band），松手 spring 回位；
 * - 支持无障碍调节（音量键/读屏左右滑动 ±5%）；
 * - 尊重「减少动态效果」：reduced 时不做越界拉伸与回弹动画。
 *
 * 仍然保持旧 API：onSeek / onPreview / onZone（播放器要用 onZone 把这条区域
 * 从下滑关闭手势里排除）。
 */

const THUMB_SIZE = 14
/** 越界拉伸的最大位移占轨道宽度的比例 */
const OVERSCROLL_RATIO = 0.18

export default memo(({
  value,
  max,
  height = 6,
  fillColor = '#FFFFFF',
  trackColor = 'rgba(255,255,255,0.34)',
  thumbColor,
  hitSlopY = 16,
  disabled = false,
  accessibilityLabel = '播放进度',
  onSeek,
  onPreview,
  onZone,
}: {
  value: number
  max: number
  height?: number
  fillColor?: string
  trackColor?: string
  thumbColor?: string
  hitSlopY?: number
  disabled?: boolean
  accessibilityLabel?: string
  /** 松手后提交 */
  onSeek: (time: number) => void
  /** 拖动过程中回传，用于实时更新时间文字 */
  onPreview?: (time: number) => void
  /** 上报自己在屏幕上的 y 区间（播放器要用它把这块区域从下滑手势里排除） */
  onZone?: (top: number, bottom: number) => void
}) => {
  const widthRef = useRef(0)
  /** 进度条在屏幕上的左边缘：用 pageX - left 算比例，比 locationX 在子 View 上更可靠 */
  const leftRef = useRef(0)
  const measuredRef = useRef(false)
  const [width, setWidth] = useState(0)
  const boxRef = useRef<View>(null)
  const [dragRatio, setDragRatio] = useState<number | null>(null)
  const overshoot = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const reduced = useReducedMotion()

  const containerHeight = height + hitSlopY * 2

  const ratioOf = useCallback((e: GestureResponderEvent) => {
    const w = widthRef.current
    if (w <= 0) return null
    // 允许越界（<0 或 >1），越界量交给 rubber band 处理
    const pageX = e.nativeEvent.pageX
    // 刚挂载时 measureInWindow 可能还没回来：pageX 有效但 left 还是 0，
    // 直接用 pageX 会算出一个偏大的比例（表现为「点一下跳到别处/重头播」）。
    if (!measuredRef.current || !Number.isFinite(pageX) || pageX <= 0) {
      const local = e.nativeEvent.locationX
      return Number.isFinite(local) ? local / w : null
    }
    return (pageX - leftRef.current) / w
  }, [])

  const settle = useCallback(() => {
    if (reduced) {
      overshoot.setValue(0)
      scale.setValue(1)
      return
    }
    Animated.parallel([
      Animated.spring(overshoot, { toValue: 0, useNativeDriver: true, ...MotionSpring.snappy }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...MotionSpring.snappy }),
    ]).start()
  }, [overshoot, reduced, scale])

  const preview = useCallback((raw: number | null) => {
    if (disabled || raw == null) return
    const clamped = Math.max(0, Math.min(1, raw))
    const over = raw - clamped
    overshoot.setValue(reduced ? 0 : widthRef.current * OVERSCROLL_RATIO * Math.tanh(over * 3))
    if (!reduced) scale.setValue(1.25)
    setDragRatio(clamped)
    onPreview?.(clamped * (max || 0))
  }, [disabled, max, onPreview, overshoot, reduced, scale])

  const commit = useCallback((raw: number | null) => {
    if (disabled || raw == null) return
    const clamped = Math.max(0, Math.min(1, raw))
    setDragRatio(null)
    settle()
    onSeek(clamped * (max || 0))
  }, [disabled, max, onSeek, settle])

  const handleAccessibilityAction = useCallback((actionName: string) => {
    if (disabled) return
    const step = Math.max(5, (max || 0) * 0.05)
    const next = Math.max(0, Math.min(max || 0, value + (actionName === 'increment' ? step : -step)))
    onSeek(next)
  }, [disabled, max, onSeek, value])

  /*
    用 PanResponder 而不是裸 responder：
    播放器根节点有一个「下滑关闭」的 capture 手势，裸 responder 在这个 Nest 里
    水平 move 会被父级终止（实测拖不动、只有按下/抬起能 seek）。
    PanResponder 在 start 阶段就 capture，并拒绝父级 termination，拖动能稳定拿到 move。
  */
  /*
    用 ref 存回调，PanResponder 只依赖 disabled：
    播放中进度每 100ms 更新一次，onSeek/onPreview 若参与依赖会让 PanResponder
    在拖动过程中被重建，手势序列被打断（表现为只能点不能滑）。
  */
  const handlersRef = useRef({ preview, commit, ratioOf, settle })
  handlersRef.current = { preview, commit, ratioOf, settle }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onStartShouldSetPanResponderCapture: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponderCapture: () => !disabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => { handlersRef.current.preview(handlersRef.current.ratioOf(e)) },
    onPanResponderMove: e => { handlersRef.current.preview(handlersRef.current.ratioOf(e)) },
    onPanResponderRelease: e => { handlersRef.current.commit(handlersRef.current.ratioOf(e)) },
    onPanResponderTerminate: () => { setDragRatio(null); handlersRef.current.settle() },
  }), [disabled])

  const clampedRatio = dragRatio ?? (max > 0 ? Math.max(0, Math.min(1, value / max)) : 0)
  const thumbLeft = clampedRatio * width - THUMB_SIZE / 2

  return (
    <View
      ref={boxRef}
      style={[styles.container, { height: containerHeight }]}
      accessible
      accessibilityRole='adjustable'
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: Math.round(max || 0),
        now: Math.round(value),
        text: `${formatPlayTime2(value)} / ${formatPlayTime2(max)}`,
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => { handleAccessibilityAction(e.nativeEvent.actionName) }}
      onLayout={e => {
        widthRef.current = e.nativeEvent.layout.width
        setWidth(e.nativeEvent.layout.width)
        const node = boxRef.current
        if (!node) return
        node.measureInWindow((x, y, w, h) => {
          leftRef.current = x
          measuredRef.current = true
          onZone?.(y, y + h)
        })
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
        <View
          style={{ height, borderRadius: height / 2, width: `${clampedRatio * 100}%`, backgroundColor: fillColor }}
        />
      </View>
      {
        width > 0
          ? (
            <Animated.View
              pointerEvents='none'
              style={[
                styles.thumb,
                {
                  left: thumbLeft,
                  top: (containerHeight - THUMB_SIZE) / 2,
                  width: THUMB_SIZE,
                  height: THUMB_SIZE,
                  borderRadius: THUMB_SIZE / 2,
                  backgroundColor: thumbColor ?? fillColor,
                  transform: [{ translateX: overshoot }, { scale }],
                },
              ]}
            />
            )
          : null
      }
    </View>
  )
})

const styles = createStyle({
  container: {
    width: '100%',
    justifyContent: 'center',
  },
  track: {
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
  },
})
