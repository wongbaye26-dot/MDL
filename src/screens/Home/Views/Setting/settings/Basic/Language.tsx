import { memo } from 'react'

import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Chip from '@/components/common/Chip'
import type { I18n } from '@/lang'
import { useI18n, langList } from '@/lang'
import { setLanguage } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const t = useI18n()
  const activeLangId = useSettingValue('common.langId')

  return (
    <SubTitle title={t('setting_basic_lang')}>
      <View style={styles.list}>
        {
          langList.map(({ locale, name }: { locale: I18n['locale'], name: string }) => (
            <View key={locale} style={styles.chipWrap}>
              <Chip
                soft
                label={name}
                active={activeLangId == locale}
                onPress={() => { setLanguage(locale) }}
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
