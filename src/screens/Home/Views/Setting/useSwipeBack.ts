import { useCallback, useMemo, useRef } from 'react'
import { Animated, Easing, PanResponder } from 'react-native'

import { useWindowSize } from '@/utils/hooks'
import { isInteractiveTouch, setInteractiveTouch } from './swipeBackGuard'

/**
 * 设置二级页（整屏 overlay）的「左滑返回」手势。
 *
 * 用法：
 *   const swipeBack = useSwipeBack(() => { setActiveId(null) })
 *   <Animated.View {...swipeBack.panHandlers} style={[overlayStyle, swipeBack.animatedStyle]}>
 *     ...子页内容...
 *   </Animated.View>
 * 重新打开子页前要调用 `swipeBack.reset()`（上一次滑出会把整页平移到屏幕外）。
 *
 * 为什么要用「捕获阶段」抢手势：
 *   子页 overlay 挂在 Home 的 PagerView（原生 ViewPager2）里面，横滑默认会被它当成切 Tab。
 *   在 onMoveShouldSetPanResponderCapture 里先于下层判断并接管后，RN 会对上层 View 调用
 *   requestDisallowInterceptTouchEvent(true)，ViewPager 就不会再拦截这一次滑动。
 *
 * 为什么起手阈值是 4dp 而不是 Android 默认的 8dp：
 *   原生 PagerView 的触摸斜率就是 ViewConfiguration.getScaledTouchSlop()（8dp），一旦某次
 *   ACTION_MOVE 超过 8dp，它会先于 JS 抢走手势（并给 JS 发 CANCEL）。所以必须在 8dp 之前
 *   拿到 responder，这里取 4dp（仍远大于点击抖动，且要求横向占优，不会误伤竖向滚动/点击）。
 */

/** 横向占优的判定：|dx| 要明显大于 |dy| 才算左滑，避免抢走竖向滚动 */
const HORIZONTAL_RATIO = 1.2
/** 起手判定距离（dp），必须小于原生 PagerView 的 8dp 触摸斜率，理由见文件头注释 */
const CAPTURE_SLOP = 4
/** 松手判定：滑过屏宽 25%，或者快速甩动（vx < -0.5）就滑出关闭 */
const CLOSE_RATIO = 0.25
const FLING_VELOCITY = 0.5
/** 拖动过程中整页最多淡到 0.55，滑出阶段再单独淡到 0 */
const MIN_DRAG_OPACITY = 0.55

export default (onClose: () => void) => {
  const { width: windowWidth } = useWindowSize()
  const translateX = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  /** 旋转屏幕时会变，手势回调里用 ref 取最新值，避免重建 PanResponder */
  const windowWidthRef = useRef(windowWidth)
  windowWidthRef.current = windowWidth
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  /** 没滑够就弹回原位 */
  const animateBack = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 12,
        tension: 96,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }, [translateX, opacity])

  /** 滑出屏幕后关闭子页 */
  const animateOut = useCallback(() => {
    const width = windowWidthRef.current || 1
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -width,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onCloseRef.current()
    })
  }, [translateX, opacity])

  /** 松手/被系统 cancel 时统一判定：够远或够快就关闭，否则弹回 */
  const finish = useCallback((dx: number, vx: number) => {
    const width = windowWidthRef.current || 1
    if (Math.abs(dx) > width * CLOSE_RATIO || vx < -FLING_VELOCITY) animateOut()
    else animateBack()
  }, [animateOut, animateBack])

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gestureState) => {
      // 滑杆等「本来就要横滑」的控件已经标记了这次触摸，别抢
      if (isInteractiveTouch()) return false
      // 多指（比如双指缩放）不抢
      if (gestureState.numberActiveTouches > 1) return false
      return gestureState.dx < -CAPTURE_SLOP &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * HORIZONTAL_RATIO
    },
    onPanResponderGrant: () => {
      // 上一次的动画（比如弹回）可能还没播完，先停掉再跟手
      translateX.stopAnimation()
      opacity.stopAnimation()
    },
    onPanResponderMove: (_, gestureState) => {
      const width = windowWidthRef.current || 1
      // 只允许往左拖，最多拖一整屏
      const x = Math.max(-width, Math.min(0, gestureState.dx))
      translateX.setValue(x)
      opacity.setValue(1 - Math.abs(x) / width * (1 - MIN_DRAG_OPACITY))
    },
    onPanResponderRelease: (_, gestureState) => { finish(gestureState.dx, gestureState.vx) },
    // 快速甩动时原生 View 层有时会直接 cancel JS 手势：用最后的速度/位移兜底，
    // 该关的还是要关，不能出现「甩出去一半又弹回来」
    onPanResponderTerminate: (_, gestureState) => { finish(gestureState.dx, gestureState.vx) },
    // 已经把整页接管了，拖动过程中不要再被下层 ScrollView/PagerView 抢走
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [finish, translateX, opacity])

  /** 子页重新打开前复位（上一次可能是滑出关闭，值还停在屏幕外） */
  const reset = useCallback(() => {
    translateX.stopAnimation()
    opacity.stopAnimation()
    translateX.setValue(0)
    opacity.setValue(1)
    // 顺便清掉可能残留的「交互控件触摸」标记，避免下一次滑动手势被误判
    setInteractiveTouch(false)
  }, [translateX, opacity])

  return {
    panHandlers: panResponder.panHandlers,
    /** 挂到 overlay 的 Animated.View 上：跟手平移 + 同步淡出 */
    animatedStyle: useMemo(() => ({
      opacity,
      transform: [{ translateX }],
    }), [translateX, opacity]),
    reset,
  }
}
