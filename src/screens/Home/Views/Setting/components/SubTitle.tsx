import { memo } from 'react'

import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

export default memo(({ title, children }: {
  title: string
  children: React.ReactNode | React.ReactNode[]
}) => {
  const theme = useTheme()

  return (
    <View style={styles.container}>
      <Text size={13} color={theme['c-450']} style={styles.title}>{title}</Text>
      {children}
    </View>
  )
})


const styles = createStyle({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 13,
    paddingBottom: 14,
  },
  title: {
    marginBottom: 9,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
})
