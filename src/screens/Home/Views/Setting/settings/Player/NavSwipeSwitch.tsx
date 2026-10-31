import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

/** 底部导航胶囊左右滑动切歌开关 */
export default memo(() => {
  const theme = useTheme()
  const enabled = useSettingValue('common.navSwipeSwitch')

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={enabled}
        onChange={v => { updateSetting({ 'common.navSwipeSwitch': v }) }}
        label='底部导航滑动切歌'
      >
        <Text size={11} color={theme['c-450']}>在底部胶囊上左右滑动，切换上一曲 / 下一曲</Text>
      </CheckBoxItem>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
