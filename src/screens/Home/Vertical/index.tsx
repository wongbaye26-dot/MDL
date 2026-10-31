import { View } from 'react-native'
import Content from './Content'
import BottomNav from './BottomNav'
import { useNavActiveId } from '@/store/common/hook'

export default () => {
  const navActiveId = useNavActiveId()

  // 导航是覆盖在内容之上的悬浮胶囊：容器不占位，内容可以滚到胶囊底下，
  // 胶囊以外完全透明（各页面自己在底部留出 NAV_BAR_SPACE 的空白）
  return (
    <View style={{ flex: 1 }}>
      <Content />
      {navActiveId === 'nav_player' ? null : <BottomNav />}
    </View>
  )
}
