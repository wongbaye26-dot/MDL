import { useCallback, useRef } from 'react'
import { Animated, TouchableOpacity } from 'react-native'

import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export interface ChipProps {
  label: string
  active?: boolean
  /** 选中时使用柔和填充，用于二级筛选 */
  soft?: boolean
  size?: 'sm' | 'md'
  icon?: string
  onPress?: () => void
  onLongPress?: () => void
}

export default ({ label, active = false, soft = false, size = 'md', icon, onPress, onLongPress }: ChipProps) => {
  const theme = useTheme()
  const isSm = size === 'sm'
  const backgroundColor = active
    ? (soft ? theme['c-primary-alpha-800'] : theme['c-primary'])
    : theme['c-primary-alpha-900']
  const borderColor = active
    ? (soft ? theme['c-primary-alpha-500'] : theme['c-primary'])
    : theme['c-primary-alpha-700']
  const color = active
    ? (soft ? theme['c-primary-light-200'] : '#FFFFFF')
    : theme['c-450']

  // 按压时轻微回弹，比单纯改透明度更有手感（native driver，不阻塞 JS）
  const scale = useRef(new Animated.Value(1)).current
  const animate = useCallback((toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start()
  }, [scale])

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => { animate(0.93) }}
        onPressOut={() => { animate(1) }}
        style={{ ...(isSm ? styles.chipSm : styles.chipMd), backgroundColor, borderColor }}
      >
        { icon ? <Icon name={icon} size={isSm ? 10 : 11} color={color} style={styles.icon} /> : null }
        <Text
          size={isSm ? 11 : 12}
          color={color}
          numberOfLines={1}
          style={{
            ...styles.label,
            // 胶囊是固定高度 + alignItems center 的，这里再关掉 Android 字号自带的
            // 上下 font padding，保证中英数混排时文字都在胶囊正中间
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
        >{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = createStyle({
  chipSm: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 13,
    borderWidth: 0.5,
    marginRight: 8,
  },
  chipMd: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingLeft: 13,
    paddingRight: 13,
    borderRadius: 15,
    borderWidth: 0.5,
    marginRight: 8,
    maxWidth: 200,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontWeight: '500',
  },
})
