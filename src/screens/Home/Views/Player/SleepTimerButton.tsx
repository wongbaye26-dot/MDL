import { memo } from 'react'
import { TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { useSleepTimerInfo } from '@/core/player/sleepTimer'

/**
 * 定时关闭入口按钮。
 *
 * 单独抽成组件，是为了让「剩余时间每秒变化」的订阅只重渲染这颗按钮，
 * 而不是整页 2000 行的播放器。
 */
export default memo(({
  onPress,
  size = 21,
  color = 'rgba(255,255,255,0.92)',
  activeColor = '#FFD166',
  style,
}: {
  onPress: () => void
  size?: number
  color?: string
  activeColor?: string
  style?: StyleProp<ViewStyle>
}) => {
  const info = useSleepTimerInfo()

  return (
    <TouchableOpacity
      style={style}
      activeOpacity={0.7}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole='button'
      accessibilityLabel='定时关闭'
      accessibilityHint={info.mode ? '定时关闭已开启，点按修改或取消' : '设置定时暂停播放'}
    >
      <Icon name='timer-outline' size={size} color={info.mode ? activeColor : color} />
    </TouchableOpacity>
  )
})
