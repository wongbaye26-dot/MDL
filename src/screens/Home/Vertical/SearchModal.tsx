import { View, StyleSheet } from 'react-native'
import Search from '@/screens/Home/Views/Search'
import { useTheme } from '@/store/theme/hook'

export default ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme()

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 24 }]}>
      <View style={{ flex: 1, backgroundColor: theme['c-main-background'] }}>
        <Search onClose={onClose} />
      </View>
    </View>
  )
}
