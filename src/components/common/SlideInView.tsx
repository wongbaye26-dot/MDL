import { useEffect, useRef } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

/** 统一的「从下往上」进场动画容器 */
export default ({ children, style }: { children: React.ReactNode, style?: StyleProp<ViewStyle> }) => {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [anim])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [64, 0] }),
          }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
