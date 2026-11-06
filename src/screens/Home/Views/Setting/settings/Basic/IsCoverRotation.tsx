import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

/** 胶囊任务栏 / 迷你播放器专辑封面自转开关 */
export default memo(() => {
  const theme = useTheme()
  const enabled = useSettingValue('common.coverRotation')
  return (
    <View style={styles.content}>
      <CheckBoxItem check={enabled} onChange={v => { updateSetting({ 'common.coverRotation': v }) }} label='专辑封面自转'>
        <Text size={11} color={theme['c-450']}>播放时底部胶囊/迷你播放器的专辑圆盘缓慢旋转</Text>
      </CheckBoxItem>
    </View>
  )
})

const styles = createStyle({ content: { marginTop: 5 } })
