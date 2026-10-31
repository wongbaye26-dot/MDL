import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

/** 歌词单行显示开关 */
export default memo(() => {
  const theme = useTheme()
  const isSingleLine = useSettingValue('player.isSingleLineLyric')

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isSingleLine}
        onChange={v => { updateSetting({ 'player.isSingleLineLyric': v }) }}
        label='一行显示'
      >
        <Text size={11} color={theme['c-450']}>开启后全屏歌词只显示当前这一行</Text>
      </CheckBoxItem>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
