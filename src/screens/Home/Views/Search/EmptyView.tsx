import { View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export default () => {
  const t = useI18n()
  const theme = useTheme()

  return (
    <View style={styles.wrap}>
      <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-900'] }}>
        <Icon name='magnify-close' size={26} color={theme['c-400']} />
      </View>
      <Text size={13} style={styles.title}>{t('search_no_result')}</Text>
      <Text size={11} color={theme['c-450']} style={styles.tip}>{t('search_no_result_tip')}</Text>
    </View>
  )
}

const styles = createStyle({
  wrap: {
    alignItems: 'center',
    paddingTop: 64,
    paddingLeft: 24,
    paddingRight: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 14,
    fontWeight: '600',
  },
  tip: {
    marginTop: 6,
    textAlign: 'center',
  },
})
