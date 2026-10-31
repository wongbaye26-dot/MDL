import { View } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'

export default () => {
  const theme = useTheme()
  const info = usePlayerMusicInfo()

  return (
    <View style={styles.container}>
      <Text size={19} numberOfLines={1} style={styles.name}>{info.name}</Text>
      <Text size={12} color={theme['c-450']} numberOfLines={1} style={styles.singer}>{info.singer}</Text>
    </View>
  )
}

const styles = createStyle({
  container: {
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    marginTop: 14,
    marginBottom: 6,
  },
  name: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  singer: {
    marginTop: 5,
    textAlign: 'center',
  },
})
