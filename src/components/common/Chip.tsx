import { useCallback, useRef, type ReactNode } from 'react'
import { Animated, TouchableOpacity } from 'react-native'

import Text from './Text'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { setSpText } from '@/utils/pixelRatio'

export interface ChipProps {
  /** 胶囊文字；给了 children 时可以省略（文字只用于无障碍标签/回退） */
  label?: string
  /** 自定义内容（如音源品牌 LOGO），给了就替代文字 */
  children?: ReactNode
  /** 自定义无障碍标签（内容不是文字时用，例如只显示 LOGO 的来源胶囊） */
  accessibilityLabel?: string
  active?: boolean
  /** 选中时使用柔和填充，用于二级筛选 */
  soft?: boolean
  size?: 'sm' | 'md'
  icon?: string
  onPress?: () => void
  onLongPress?: () => void
}

export default ({ label, children, accessibilityLabel, active = false, soft = false, size = 'md', icon, onPress, onLongPress }: ChipProps) => {
  const theme = useTheme()
  const isSm = size === 'sm'
  const fontSize = isSm ? 11 : 12
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

  // 有 children 时用自定义内容（如音源品牌 LOGO），否则显示 label 文字
  const content = children ?? (label != null
    ? (
        <Text
          size={fontSize}
          color={color}
          numberOfLines={1}
          style={{
            ...styles.label,
            // 胶囊是固定高度 + alignItems center 的，这里再关掉 Android 字号自带的
            // 上下 font padding；lineHeight 压到「字号+2」和 Tag 原语同一套配方，
            // 中英数混排时字形才会真的在胶囊正中间（只靠 alignItems 仍会有约 1dp 基线偏移）
            includeFontPadding: false,
            textAlignVertical: 'center',
            lineHeight: setSpText(fontSize + 2),
          }}
        >{label}</Text>
      )
    : null)

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={accessibilityLabel ?? label}
        onPressIn={() => { animate(0.93) }}
        onPressOut={() => { animate(1) }}
        style={{ ...(isSm ? styles.chipSm : styles.chipMd), backgroundColor, borderColor }}
      >
        { icon ? <Icon name={icon} size={isSm ? 10 : 11} color={color} style={styles.icon} /> : null }
        {content}
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
