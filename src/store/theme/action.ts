import { buildActiveThemeColors } from '@/theme/themes'
import state from './state'


export default {
  setTheme(theme: LX.Theme | LX.ActiveTheme) {
    // 已是完整配色对象（如 Material You 动态生成）时直接应用
    state.theme = 'config' in theme ? buildActiveThemeColors(theme) : theme
    global.state_event.themeUpdated(state.theme)
  },
  setShouldUseDarkColors(shouldUseDarkColors: boolean) {
    if (state.shouldUseDarkColors == shouldUseDarkColors) return
    state.shouldUseDarkColors = shouldUseDarkColors
  },
}

