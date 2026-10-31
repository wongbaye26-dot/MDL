import { View } from 'react-native'
import Header from './Header'
import Main from './Main'
import { createStyle } from '@/utils/tools'

const Content = () => {
  return (
    <View style={styles.container}>
      <Header />
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
