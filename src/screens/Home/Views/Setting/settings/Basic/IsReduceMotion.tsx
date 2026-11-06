import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

/**
 * 减少动态效果开关。
 *
 * 开启后：
 * - 页面/浮层过渡直接落终态，不再播放入场动画；
 * - 首页四卡、圆盘呼吸、跑马灯等长驻循环动画停止；
 * - 系统无障碍「移除动画」开启时自动生效（见 useReducedMotion）。
 */
export default memo(() => {
  const theme = useTheme()
  const reduceMotion = useSettingValue('common.reduceMotion')

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={reduceMotion}
        onChange={v => { updateSetting({ 'common.reduceMotion': v }) }}
        label='减少动态效果'
      >
        <Text size={11} color={theme['c-450']}>
          关闭大部分过渡与循环动画，降低眩晕与耗电；系统无障碍开启时自动生效
        </Text>
      </CheckBoxItem>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
