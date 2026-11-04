import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import CheckBoxItem from '../../components/CheckBoxItem'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const t = useI18n()
  const isAutoJyutping = useSettingValue('player.isAutoJyutping')

  return (
    <View style={styles.content}>
      <CheckBoxItem
        check={isAutoJyutping}
        onChange={check => { updateSetting({ 'player.isAutoJyutping': check }) }}
        label={t('setting_play_auto_jyutping')}
      />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
