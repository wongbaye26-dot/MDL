
import { memo } from 'react'
import { View } from 'react-native'

import Slider, { type SliderProps } from '@react-native-community/slider'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { setInteractiveTouch } from '../swipeBackGuard'

export type {
  SliderProps,
}

export default memo(({ value, minimumValue, maximumValue, onSlidingStart, onSlidingComplete, onValueChange, step }: SliderProps) => {
  const theme = useTheme()

  return (
    // 包一层 View 是为了拿到 JS 触摸事件：设置子页的「左滑返回」是整页捕获阶段手势，
    // 拖滑杆时要把这次触摸标记成「交互控件」，让左滑返回放弃接管（否则页面会跟着平移、滑杆卡住）。
    <View
      style={styles.sliderWrap}
      onTouchStart={() => { setInteractiveTouch(true) }}
      onTouchEnd={() => { setInteractiveTouch(false) }}
      onTouchCancel={() => { setInteractiveTouch(false) }}
    >
      <Slider
        value={value}
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        minimumTrackTintColor={theme['c-button-background-active']}
        maximumTrackTintColor={theme['c-button-background']}
        thumbTintColor={theme['c-primary-light-100']}
        onSlidingStart={onSlidingStart}
        onSlidingComplete={onSlidingComplete}
        onValueChange={onValueChange}
        step={step}
      />
    </View>
  )
})


const styles = createStyle({
  sliderWrap: {
    flexShrink: 0,
    flexGrow: 1,
    flexDirection: 'row',
  },
  slider: {
    flexShrink: 0,
    flexGrow: 1,
    // width: '100%',
    maxWidth: 300,
    height: 40,
    marginTop: -6,
  },
})
