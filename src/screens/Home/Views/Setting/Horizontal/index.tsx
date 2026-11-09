import { View } from 'react-native'

import Main from '../Vertical/Main'
import { createStyle } from '@/utils/tools'

/**
 * 横屏设置：扁平分组设置页占满内容区（不再使用左侧宫格导航卡），
 * 深页（音源管理 / 曲库工具）仍走 Main 的整屏 overlay，返回手势一致。
 */
export default () => (
  <View style={styles.container}>
    <Main />
  </View>
)

const styles = createStyle({
  container: {
    flex: 1,
    paddingTop: 2,
    // 不再给底部胶囊预留一整条空白：设置内容铺到屏幕底部，
    // 胶囊作为玻璃浮层盖在内容上；列表自身用 paddingBottom 保证最后一项可滚出来。
  },
})
