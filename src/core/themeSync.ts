import { Navigation } from 'react-native-navigation'

import commonState from '@/store/common/state'
import { setWindowBackgroundColor } from '@/utils/nativeModules/utils'
import { toHexColor } from '@/theme/solid'

/**
 * 把主题色同步到原生层。
 *
 * 切换主题时 JS 会整棵树重渲染，在首帧提交之前会有一瞬间「什么都没画」，
 * 露出的是原生窗口/屏幕底色（系统 DayNight 下亮色白、暗色黑）——
 * 这就是用户看到的黑白闪屏。把原生底色也换成当前主题色，闪的就是主题色本身，
 * 配合 ThemeProvider 的淡入遮罩基本看不出跳变。
 */
export const syncNativeTheme = (theme: LX.ActiveTheme) => {
  const fallback = theme.isDark ? '#121214' : '#FFFFFF'
  const color = toHexColor(theme['c-main-background'], fallback)

  setWindowBackgroundColor(color)

  try {
    const options = { layout: { componentBackgroundColor: color } }
    Navigation.setDefaultOptions(options)
    for (const id of Object.values(commonState.componentIds)) {
      if (!id) continue
      Navigation.mergeOptions(id, options)
    }
  } catch (err) {
    console.log('syncNativeTheme failed', err)
  }
}
