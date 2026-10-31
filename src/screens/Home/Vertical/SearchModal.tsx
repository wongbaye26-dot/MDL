import { View, TouchableOpacity, StyleSheet } from 'react-native'
import Search from '@/screens/Home/Views/Search'
import SearchTypeSelector from '@/screens/Home/Views/Search/SearchTypeSelector'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'

export default ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}>
      <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
        <View style={{ ...styles.header, height: 48 + statusBarHeight, paddingTop: statusBarHeight }}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="chevron-left-2" size={20} color={theme['c-font']} />
          </TouchableOpacity>
          <View style={styles.typeSelector}>
            <SearchTypeSelector />
          </View>
        </View>
        <View style={styles.content}>
          <Search />
        </View>
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
    paddingRight: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeSelector: {
    flexGrow: 1,
    flexShrink: 1,
  },
  content: {
    flex: 1,
  },
})
