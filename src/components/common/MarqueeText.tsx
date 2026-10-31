import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, View, type StyleProp, type TextStyle } from 'react-native'

import Text from './Text'

/**
 * 单行超长文本自动横向滚动。
 *
 * RN 没有原生 marquee：这里用「绝对定位的 Animated.View（按内容撑宽）+ translateX」
 * 让文字不被父宽裁掉，父容器 overflow:hidden 负责裁切。
 * 文本比容器短时不滚动，行为和普通 Text 一致。
 */
export default ({
  text,
  size = 21,
  color = '#FFFFFF',
  style,
  active = true,
}: {
  text: string
  size?: number
  color?: string
  style?: StyleProp<TextStyle>
  /** 为 false 时停在起始位置（比如暂停） */
  active?: boolean
}) => {
  const [boxWidth, setBoxWidth] = useState(0)
  const [textWidth, setTextWidth] = useState(0)
  const translateX = useRef(new Animated.Value(0)).current

  const shouldScroll = active && boxWidth > 0 && textWidth > boxWidth + 4

  useEffect(() => {
    if (!shouldScroll) {
      translateX.stopAnimation()
      translateX.setValue(0)
      return
    }
    const distance = textWidth - boxWidth + 20
    const duration = Math.max(3600, Math.round(distance * 38))
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(1400),
      Animated.timing(translateX, {
        toValue: -distance,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.delay(900),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]))
    loop.start()
    return () => { loop.stop() }
  }, [shouldScroll, textWidth, boxWidth, translateX])

  const lineHeight = Math.round(size * 1.45)

  return (
    <View
      style={{ overflow: 'hidden', height: lineHeight, justifyContent: 'center' }}
      onLayout={e => { setBoxWidth(e.nativeEvent.layout.width) }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: lineHeight,
          justifyContent: 'center',
          transform: [{ translateX }],
        }}
      >
        <Text
          size={size}
          color={color}
          numberOfLines={1}
          style={style}
          onLayout={e => { setTextWidth(e.nativeEvent.layout.width) }}
        >{text}</Text>
      </Animated.View>
    </View>
  )
}
