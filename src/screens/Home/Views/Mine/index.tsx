import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import PageHeader from '@/components/common/PageHeader'
import Setting from '../Setting'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const emoLogo = require('@/resources/images/emo-logo.png')

export default () => {
  return (
    <View style={styles.container}>
      <PageHeader
        logo={emoLogo}
        title='我的'
        subtitle='Emo音乐 · 深夜下载 · 情绪收藏'
      />
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
  setting: {
    flex: 1,
  },
})
