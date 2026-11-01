import { useCallback, useEffect, useRef } from 'react'
import { Animated, Easing, View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'

export interface BigCardProps {
  title: string
  icon: string
  color: string
  /** 卡片序号，用来错开动画相位（不然五张卡会整齐地一起呼吸） */
  index?: number
  onPress: () => void
}

/**
 * 首页大卡片。
 *
 * 背景加了两层持续动效（全部走 native driver，不占 JS 线程）：
 *  1. 水印图标缓慢上下浮动 + 轻微旋转，像浮在液体里；
 *  2. 每隔几秒一道柔光从左上扫到右下。
 * 相位按 index 错开，五张卡不会整齐划一地一起动。
 */
export default ({ title, icon, color, index = 0, onPress }: BigCardProps) => {
  // 按下时卡片轻微下沉，松手回弹 —— 比单纯降低透明度更有实体感
  const scale = useRef(new Animated.Value(1)).current
  const float = useRef(new Animated.Value(0)).current
  const sweep = useRef(new Animated.Value(0)).current

  const animate = useCallback((toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 32,
      bounciness: 7,
    }).start()
  }, [scale])

  useEffect(() => {
    const delay = index * 240

    const floatLoop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(float, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))

    const sweepLoop = Animated.loop(Animated.sequence([
      Animated.delay(delay + 1800),
      Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(3200),
    ]))

    floatLoop.start()
    sweepLoop.start()
    return () => {
      floatLoop.stop()
      sweepLoop.stop()
    }
  }, [float, sweep, index])

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={{ ...styles.card, backgroundColor: color }}
        onPress={onPress}
        onPressIn={() => { animate(0.955) }}
        onPressOut={() => { animate(1) }}
      >
        <View style={styles.bubble} pointerEvents='none' />
        <View style={styles.bubbleSmall} pointerEvents='none' />

        <Animated.View
          pointerEvents='none'
          style={{
            ...styles.watermark,
            transform: [
              { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [4, -6] }) },
              { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
            ],
          }}
        >
          <Icon name={icon} size={104} color='rgba(255,255,255,0.16)' />
        </Animated.View>

        {/* 柔光扫过 */}
        <Animated.View
          pointerEvents='none'
          style={{
            ...styles.sweep,
            opacity: sweep.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }),
            transform: [
              { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-170, 190] }) },
              { rotate: '18deg' },
            ],
          }}
        />

        <View style={styles.labelRow}>
          <Icon name={icon} size={15} color='#FFFFFF' />
          <Text size={15} color='#FFFFFF' style={styles.label}>{title}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = createStyle({
  card: {
    width: 152,
    height: 196,
    borderRadius: 18,
    marginRight: 12,
    justifyContent: 'flex-end',
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    right: -34,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bubbleSmall: {
    position: 'absolute',
    right: 26,
    top: 46,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  watermark: {
    position: 'absolute',
    left: 10,
    top: 12,
  },
  sweep: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: 74,
    height: 280,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    marginLeft: 6,
    fontWeight: '600',
  },
})
