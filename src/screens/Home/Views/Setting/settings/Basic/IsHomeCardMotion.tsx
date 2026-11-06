import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

/** 首页 5 卡装饰动效开关（柱状/唱片/爱心/波纹/统计呼吸） */
export default memo(() => {
  const theme = useTheme()
  const enabled = useSettingValue('common.homeCardMotion')
  return (
    <View style={styles.content}>
      <CheckBoxItem check={enabled} onChange={v => { updateSetting({ 'common.homeCardMotion': v }) }} label='首页卡片动效'>
        <Text size={11} color={theme['c-450']}>控制排行榜柱状、歌单唱片、收藏爱心、音源波纹、统计卡的循环动画</Text>
      </CheckBoxItem>
    </View>
  )
})

const styles = createStyle({ content: { marginTop: 5 } })
