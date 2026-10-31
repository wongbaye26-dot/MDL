import { useCallback, useRef } from 'react'
import { Animated, View, TouchableOpacity } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'

export interface BigCardProps {
  title: string
  icon: string
  color: string
  onPress: () => void
}

export default ({ title, icon, color, onPress }: BigCardProps) => {
  // 按下时卡片轻微下沉，松手回弹 —— 比单纯降低透明度更有实体感
  const scale = useRef(new Animated.Value(1)).current
  const animate = useCallback((toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 32,
      bounciness: 7,
    }).start()
  }, [scale])

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
        <View style={styles.watermark} pointerEvents='none'>
          <Icon name={icon} size={104} color='rgba(255,255,255,0.16)' />
        </View>
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    marginLeft: 6,
    fontWeight: '600',
  },
})
