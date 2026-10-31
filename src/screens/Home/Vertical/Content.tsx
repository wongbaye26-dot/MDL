import { View } from 'react-native'
import Main from './Main'
import StatusBar from '@/components/common/StatusBar'
import { createStyle } from '@/utils/tools'

const Content = () => {
  return (
    <View style={styles.container}>
      <StatusBar />
      <Main />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
})

export default Content
