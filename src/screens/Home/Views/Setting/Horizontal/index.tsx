import { View } from 'react-native'

import Main from '../Main'
import { createStyle } from '@/utils/tools'
import { NAV_BAR_SPACE } from '@/config/constant'

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
    paddingBottom: NAV_BAR_SPACE,
  },
})
