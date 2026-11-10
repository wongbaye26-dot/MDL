import { View } from 'react-native'
import Main from './Main'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

const Content = () => {
  const theme = useTheme()

  /*
   * 根容器必须有背景色，否则主题切换重渲染的瞬间会露出 window 底色（白/黑屏）。
   *
   * 注意：这里**不能**换成 getSolidBackground 的不透明色。
   * PageContent 里铺了一张固定的背景图（theme['bg-image'] / 用户背景图），
   * 页面主背景本来就是半透明，让背景图透出来；压成不透明会把背景图整块盖掉。
   */
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
