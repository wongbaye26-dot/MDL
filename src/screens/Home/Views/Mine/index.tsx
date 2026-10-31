import { View, Image } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import Setting from '../Setting'

const emoLogo = require('@/resources/images/emo-logo.png')

export default () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={styles.container}>
      <View style={{ ...styles.card, paddingTop: statusBarHeight + 16 }}>
        <View style={{ ...styles.cardInner, backgroundColor: theme['c-primary-alpha-900'], borderColor: theme['c-primary-alpha-700'] }}>
          <Image source={emoLogo} style={styles.logo} />
          <View style={styles.info}>
            <Text size={20} style={styles.name}>EMO音乐</Text>
            <Text size={11} color={theme['c-450']} style={styles.slogan}>深夜下载 · 情绪收藏</Text>
          </View>
        </View>
      </View>
      <View style={styles.setting}>
        <Setting />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  card: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 8,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 0.5,
    padding: 14,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 17,
    marginRight: 14,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
  },
  name: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  slogan: {
    marginTop: 4,
    letterSpacing: 0.5,
  },
  setting: {
    flex: 1,
  },
})
