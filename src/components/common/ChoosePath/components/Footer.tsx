import { memo } from 'react'
import { View } from 'react-native'

import CapsuleButton from '@/components/common/CapsuleButton'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

export default memo(({ onConfirm, onHide, dirOnly }: {
  onConfirm: () => void
  onHide: () => void
  dirOnly: boolean
}) => {
  const t = useI18n()
  const theme = useTheme()
  return (
    <View style={{ ...styles.footer, backgroundColor: theme['c-content-background'], borderTopColor: theme['c-primary-alpha-700'] }}>
      <CapsuleButton icon='close' label={t('cancel')} primary={false} onPress={onHide} />
      {dirOnly
        ? (
          <>
            <View style={{ width: 10 }} />
            <CapsuleButton icon='check' label={t('confirm')} onPress={onConfirm} />
          </>
          )
        : null}
    </View>
  )
})

const styles = createStyle({
  footer: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 0.5,
    elevation: 8,
  },
})
