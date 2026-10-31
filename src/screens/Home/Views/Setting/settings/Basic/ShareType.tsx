import { memo, useMemo } from 'react'

import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Chip from '@/components/common/Chip'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { createStyle } from '@/utils/tools'

type ShareType = LX.AppSetting['common.shareType']

export default memo(() => {
  const t = useI18n()
  const shareType = useSettingValue('common.shareType')

  const list = useMemo(() => {
    return [
      { id: 'system', name: t('setting_basic_share_type_system') },
      { id: 'clipboard', name: t('setting_basic_share_type_clipboard') },
    ] as const
  }, [t])

  return (
    <SubTitle title={t('setting_basic_share_type')}>
      <View style={styles.list}>
        {
          list.map(({ id, name }) => (
            <View key={id} style={styles.chipWrap}>
              <Chip
                soft
                label={name}
                active={shareType == id}
                onPress={() => { updateSetting({ 'common.shareType': id as ShareType }) }}
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
