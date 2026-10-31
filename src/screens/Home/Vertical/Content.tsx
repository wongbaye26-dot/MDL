import { View } from 'react-native'
import Main from './Main'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

const Content = () => {
  const theme = useTheme()

  // 根容器必须有背景色，否则主题切换重渲染的瞬间会露出 window 底色（白/黑屏）
  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
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
