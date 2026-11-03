import { useEffect, useRef } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

export type SlideDirection = 'up' | 'down' | 'left' | 'right' | 'fade'

/**
 * 统一的页面进场动画容器。
 *
 * 位移默认用 spring（有轻微回弹，不僵硬），透明度用短 timing（先出现再滑动）。
 * 传 durationMs 时改成固定时长的 ease-out（和 RNN 全屏页、播放器转场的时长对齐）。
 * direction 决定从哪个方向进来 —— 不同层级的页面用不同方向，
 * 用户才能从动效上分辨「我是进了子页，还是切了 tab」：
 *   up   = 从下往上（整屏子页 / 弹层）
 *   down = 从上往下（下拉出来的面板）
 *   left / right = 左右推入（列表进详情）
 *   fade = 原地淡入 + 微缩放（同级切换）
 */
export default ({ children, style, direction = 'left', durationMs }: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  direction?: SlideDirection
  /** 指定进场时长（ms）；不传就用默认 spring */
  durationMs?: number
}) => {
  const progress = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: durationMs ? Math.round(durationMs * 0.7) : 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      durationMs
        ? Animated.timing(progress, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
        : Animated.spring(progress, {
          toValue: 1,
          useNativeDriver: true,
          // 默认 spring 收紧一点：整屏子页大约 300~360ms 落位，和 RNN 全屏页观感一致
          tension: 100,
          friction: 13.5,
          restDisplacementThreshold: 0.3,
          restSpeedThreshold: 0.3,
        }),
    ])
    animation.start()
    return () => { animation.stop() }
    // durationMs 只在挂载时决定进场节奏，运行中不需要重播
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, opacity])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: direction === 'left'
                  ? [-40, 0]
                  : direction === 'right' ? [40, 0] : [0, 0],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: direction === 'up'
                  ? [28, 0]
                  : direction === 'down' ? [-28, 0] : [0, 0],
              }),
            },
            {
              // 一点点推近，比纯平移更“立体”
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [direction === 'fade' ? 0.972 : 0.985, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
