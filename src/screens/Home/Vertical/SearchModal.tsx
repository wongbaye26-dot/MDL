import { View, StyleSheet } from 'react-native'
import Search from '@/screens/Home/Views/Search'
import SlideInView from '@/components/common/SlideInView'
import { useTheme } from '@/store/theme/hook'

export default ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme()

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}>
      <SlideInView style={{ flex: 1, backgroundColor: theme['c-main-background'] }}>
        <Search onClose={onClose} />
      </SlideInView>
    </View>
  )
}
