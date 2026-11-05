import { memo, useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

const TRACK_W = 46
const TRACK_H = 28
const THUMB_SIZE = 22
const THUMB_OFF = 3
const THUMB_ON = TRACK_W - THUMB_SIZE - THUMB_OFF

/**
 * EmoMusic 自己的 Material You 开关。
 *
 * 之前设置页直接用 RN 原生 Switch（Android 系统开关样式），和 App 的
 * Material You 卡片语言不是一套。这里改成纯视觉的胶囊开关：
 *  - 整个行由 CheckBoxItem 的 TouchableOpacity 负责点击，开关本身 pointerEvents='none'；
 *  - 轨道底色用主色淡底，开启时叠一层主色实心（opacity 动画，native driver）；
 *  - 滑块 22dp 圆形白色，位移 3dp ↔ 21dp，150ms 缓动。
 */
export default memo(({ value, disabled = false }: { value: boolean, disabled?: boolean }) => {
  const theme = useTheme()
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start()
  }, [value, progress])

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_OFF, THUMB_ON],
  })

  return (
    <View
      pointerEvents='none'
      style={[
        styles.track,
        {
          backgroundColor: theme['c-primary-alpha-800'],
          borderColor: theme['c-primary-alpha-600'],
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: theme['c-primary'], opacity: progress }]}
      />
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
    </View>
  )
})

const styles = createStyle({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: 0.5,
    flexShrink: 0,
    justifyContent: 'center',
  },
  fill: {
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
})
