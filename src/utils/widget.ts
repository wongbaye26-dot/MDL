import { NativeModules } from 'react-native'

interface WidgetModuleType {
  update: (title: string, singer: string, playing: boolean, pic: string, dark: boolean, primary: string, progress: number, lyric: string) => void
  refresh: () => void
}

const widgetModule = NativeModules.WidgetModule as WidgetModuleType | undefined

/** 同步桌面小组件（2×2 / 4×1）的当前歌曲与播放状态 */
export const syncMusicWidget = (title: string, singer: string, playing: boolean, pic: string, dark: boolean, primary: string, progress: number, lyric: string) => {
  try {
    widgetModule?.update(title, singer, playing, pic, dark, primary, Math.max(0, Math.min(1000, Math.round(progress * 1000))), lyric)
  } catch {}
}
