import { Navigation } from 'react-native-navigation'

import commonState from '@/store/common/state'
import { setWindowBackgroundColor } from '@/utils/nativeModules/utils'
import { getSolidBackground, toHexColor } from '@/theme/solid'

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
  // 用不透明底色：窗口底色带透明度时，原生层会把下面的东西透出来
  const color = toHexColor(getSolidBackground(theme), fallback)

  setWindowBackgroundColor(color)

  try {
    const options = {
      layout: {
        componentBackgroundColor: color,
        // 关键：不让原生层按 WindowInsets 给屏幕容器让位。
        // 横屏时挖孔在左侧，RNN 默认会把整个屏幕往右推 96px，左边留一条窗口底色的白边；
        // 状态栏/挖孔的留白由 RN 侧用 statusbarHeight 自己处理。
        fitSystemWindows: false,
      },
    }
    Navigation.setDefaultOptions(options)
    for (const id of Object.values(commonState.componentIds)) {
      if (!id) continue
      Navigation.mergeOptions(id, options)
    }
  } catch (err) {
    console.log('syncNativeTheme failed', err)
  }
}
