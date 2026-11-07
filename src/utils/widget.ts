import { NativeModules } from 'react-native'

interface WidgetModuleType {
  update: (title: string, singer: string, playing: boolean, pic: string, dark: boolean, primary: string) => void
  refresh: () => void
}

const widgetModule = NativeModules.WidgetModule as WidgetModuleType | undefined

/** 同步桌面小组件（2×2 / 4×1）的当前歌曲与播放状态 */
export const syncMusicWidget = (title: string, singer: string, playing: boolean, pic: string, dark: boolean, primary: string) => {
  try {
    widgetModule?.update(title, singer, playing, pic, dark, primary)
  } catch {}
}
