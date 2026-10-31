import { memo } from 'react'

import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Chip from '@/components/common/Chip'
import { useI18n } from '@/lang'
import { setFontSize } from '@/core/common'
import { useFontSize } from '@/store/common/hook'
import Text from '@/components/common/Text'
import { getTextSize } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

const LIST = [
  { size: 0.8, name: 'setting_basic_font_size_80' },
  { size: 0.9, name: 'setting_basic_font_size_90' },
  { size: 1, name: 'setting_basic_font_size_100' },
  { size: 1.1, name: 'setting_basic_font_size_110' },
  { size: 1.2, name: 'setting_basic_font_size_120' },
  { size: 1.3, name: 'setting_basic_font_size_130' },
] as const

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const size = useFontSize()

  return (
    <SubTitle title={t('setting_basic_font_size')}>
      <View style={styles.preview}>
        <Text style={{ fontSize: getTextSize(14) * size }} color={theme['c-primary']}>
          {t('setting_basic_font_size_preview')}
        </Text>
      </View>
      <View style={styles.list}>
        {
          LIST.map(item => (
            <View key={item.size} style={styles.chipWrap}>
              <Chip
                soft
                label={t(item.name)}
                active={size == item.size}
                onPress={() => { setFontSize(item.size) }}
              />
            </View>
          ))
        }
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  preview: {
    justifyContent: 'center',
    paddingBottom: 10,
    height: 40,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chipWrap: {
    marginBottom: 8,
  },
})
