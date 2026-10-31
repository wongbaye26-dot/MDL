import { buildActiveThemeColors } from '@/theme/themes'
import { syncNativeTheme } from '@/core/themeSync'
import state from './state'

/** 必要的颜色键，缺任何一个都会让界面出现大面积无背景/无文字色 */
const REQUIRED_KEYS = ['c-font', 'c-main-background', 'c-content-background', 'c-primary'] as const

const isValidTheme = (theme: LX.ActiveTheme) => {
  return REQUIRED_KEYS.every(key => typeof theme[key] === 'string' && theme[key])
}

export default {
  setTheme(theme: LX.Theme | LX.ActiveTheme) {
    let next: LX.ActiveTheme
    try {
      // 已是完整配色对象（如 Material You 动态生成）时直接应用
      next = 'config' in theme ? buildActiveThemeColors(theme) : theme
    } catch (err) {
      console.warn('buildActiveThemeColors failed', err)
      return
    }
    // 配色不完整时保持当前主题，避免出现白屏/黑屏
    if (!isValidTheme(next)) {
      console.warn('invalid theme, keep current')
      return
    }
    state.theme = next
    // 先换原生底色，再通知 React 重渲染，避免中间那一帧露出系统白/黑底
    syncNativeTheme(next)
    global.state_event.themeUpdated(state.theme)
  },
  setShouldUseDarkColors(shouldUseDarkColors: boolean) {
    if (state.shouldUseDarkColors == shouldUseDarkColors) return
    state.shouldUseDarkColors = shouldUseDarkColors
  },
}

