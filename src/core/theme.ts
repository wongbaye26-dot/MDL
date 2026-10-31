import themeActions from '@/store/theme/action'
import { getTheme } from '@/theme/themes'
import { generateThemeFromSeed } from '@/theme/themes/generate'
import { updateSetting } from './common'
import themeState from '@/store/theme/state'

export const setShouldUseDarkColors = (shouldUseDarkColors: boolean) => {
  themeActions.setShouldUseDarkColors(shouldUseDarkColors)
}

export const applyTheme = (theme: LX.Theme | LX.ActiveTheme) => {
  themeActions.setTheme(theme)
}

export const setTheme = (id: string) => {
  updateSetting({ 'theme.id': id })
  void getTheme().then(theme => {
    if (theme.id == themeState.theme.id) return
    applyTheme(theme)
  })
}

/** 设置 Material You 种子色并立即生效 */
export const setSeedColor = (hex: string, isDark: boolean) => {
  updateSetting({ 'theme.seedColor': hex, 'theme.useSeed': true, 'theme.seedDark': isDark })
  applyTheme(generateThemeFromSeed(hex, isDark))
}

/** 关闭 Material You，回退到内置主题 */
export const disableSeedTheme = (fallbackId: string) => {
  updateSetting({ 'theme.useSeed': false, 'theme.id': fallbackId })
  void getTheme().then(theme => {
    applyTheme(theme)
  })
}
