import { useEffect, useRef } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

/**
 * 统一的页面进场动画容器
 * 位移用 spring（有轻微回弹，不僵硬），透明度用短 timing（先出现再滑动）
 */
export default ({ children, style }: { children: React.ReactNode, style?: StyleProp<ViewStyle> }) => {
  const progress = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(progress, {
        toValue: 1,
        useNativeDriver: true,
        friction: 12,
        tension: 82,
        restDisplacementThreshold: 0.3,
        restSpeedThreshold: 0.3,
      }),
    ])
    animation.start()
    return () => { animation.stop() }
  }, [progress, opacity])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [
            {
              translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }),
            },
            {
              // 一点点推近，比纯平移更“立体”
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
