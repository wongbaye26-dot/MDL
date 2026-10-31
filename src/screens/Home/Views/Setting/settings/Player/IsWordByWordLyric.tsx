import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

/** 歌词逐字显示开关 */
export default memo(() => {
  const theme = useTheme()
  const isWordByWord = useSettingValue('player.isWordByWordLyric')

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isWordByWord}
        onChange={v => { updateSetting({ 'player.isWordByWordLyric': v }) }}
        label='逐字显示'
      >
        <Text size={11} color={theme['c-450']}>关闭后当前歌词整行高亮，不做逐字填充</Text>
      </CheckBoxItem>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
