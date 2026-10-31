import { View, StyleSheet } from 'react-native'
import Search from '@/screens/Home/Views/Search'
import SlideInView from '@/components/common/SlideInView'
import { useTheme } from '@/store/theme/hook'
import { NAV_BAR_SPACE } from '@/config/constant'

export default ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme()

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}>
      <SlideInView style={{ flex: 1, backgroundColor: theme['c-main-background'], paddingBottom: NAV_BAR_SPACE }}>
        <Search onClose={onClose} />
      </SlideInView>
    </View>
  )
}
