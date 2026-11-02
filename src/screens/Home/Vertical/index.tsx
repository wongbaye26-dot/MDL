import { View } from 'react-native'
import Content from './Content'
import BottomNav from './BottomNav'
import { useNavActiveId } from '@/store/common/hook'
import { useOverlayVisible } from '@/utils/overlayLock'

export default () => {
  const navActiveId = useNavActiveId()
  // 整屏浮层（子页 / 多选栏）打开时收起胶囊，否则会盖住浮层底部
  const overlayVisible = useOverlayVisible()

  // 导航是覆盖在内容之上的悬浮胶囊：容器不占位，内容可以滚到胶囊底下，
  // 胶囊以外完全透明（各页面自己在底部留出 NAV_BAR_SPACE 的空白）
  return (
    <View style={{ flex: 1 }}>
      <Content />
      {navActiveId === 'nav_player' || overlayVisible ? null : <BottomNav />}
    </View>
  )
}
