import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'

export default ({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}>
      <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
        <View style={{ ...styles.header, height: 50 + statusBarHeight, paddingTop: statusBarHeight }}>
          <TouchableOpacity style={styles.back} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name='chevron-left-2' size={20} color={theme['c-font']} />
          </TouchableOpacity>
          <Text size={17} style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 16,
  },
  back: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
})
