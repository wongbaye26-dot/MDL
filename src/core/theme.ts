import themeActions from '@/store/theme/action'
import { getTheme } from '@/theme/themes'
import { generateThemeFromSeed } from '@/theme/themes/generate'
import { getSystemAccentColor } from '@/utils/nativeModules/utils'
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

/** 设置 Material You 种子色并立即生效；传 'system' 表示跟随系统主题色 */
export const setSeedColor = async(hex: string, isDark: boolean) => {
  updateSetting({ 'theme.seedColor': hex, 'theme.useSeed': true, 'theme.seedDark': isDark })
  let resolved = hex
  if (hex === 'system') {
    resolved = (await getSystemAccentColor()) ?? '#6C5CE7'
  }
  applyTheme(generateThemeFromSeed(resolved, isDark))
}

/** 关闭 Material You，回退到内置主题 */
export const disableSeedTheme = (fallbackId: string) => {
  updateSetting({ 'theme.useSeed': false, 'theme.id': fallbackId })
  void getTheme().then(theme => {
    applyTheme(theme)
  })
}
