import { memo } from 'react'

import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Chip from '@/components/common/Chip'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const t = useI18n()
  const addMusicLocationType = useSettingValue('list.addMusicLocationType')

  const options = [
    { id: 'top' as const, name: t('setting_list_add_music_location_type_top') },
    { id: 'bottom' as const, name: t('setting_list_add_music_location_type_bottom') },
  ]

  return (
    <SubTitle title={t('setting_list_add_music_location_type')}>
      <View style={styles.list}>
        {
          options.map(({ id, name }) => (
            <View key={id} style={styles.chipWrap}>
              <Chip
                soft
                label={name}
                active={addMusicLocationType == id}
                onPress={() => { updateSetting({ 'list.addMusicLocationType': id }) }}
              />
            </View>
          ))
        }
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chipWrap: {
    marginBottom: 8,
  },
})
