import { NativeModules, NativeEventEmitter } from 'react-native'

const { LyricModule } = NativeModules

/**
 * 蓝牙 / 锁屏歌词（媒体会话歌词）桥接。
 *
 * 这里只保留「把当前行歌词通过媒体会话发出去」的能力；
 * 桌面悬浮歌词窗口（原生 LyricView + SYSTEM_ALERT_WINDOW）已下架。
 */
export const setSendLyricTextEvent = async(isSend: boolean) => {
  return LyricModule.setSendLyricTextEvent(isSend)
}

/**
 * play lyric
 * @param {Number} time play time
 * @returns {Promise} Promise
 */
export const play = async(time: number): Promise<void> => {
  return LyricModule.play(time)
}

/**
 * pause lyric
 */
export const pause = async(): Promise<void> => {
  return LyricModule.pause()
}

/**
 * set lyric
 * @param lyric lyric str
 * @param translation lyric translation
 * @param romalrc lyric translation
 */
export const setLyric = async(lyric: string, translation: string, romalrc: string): Promise<void> => {
  return LyricModule.setLyric(lyric, translation || '', romalrc || '')
}

export const setPlaybackRate = async(rate: number): Promise<void> => {
  return LyricModule.setPlaybackRate(rate)
}

/**
 * toggle show translation
 * @param isShowTranslation is show translation
 */
export const toggleTranslation = async(isShowTranslation: boolean): Promise<void> => {
  return LyricModule.toggleTranslation(isShowTranslation)
}

/**
 * toggle show roma lyric
 * @param isShowRoma is show roma lyric
 */
export const toggleRoma = async(isShowRoma: boolean): Promise<void> => {
  return LyricModule.toggleRoma(isShowRoma)
}

export const onLyricLinePlay = (handler: (lineInfo: { text: string, extendedLyrics: string[] }) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(LyricModule)
  const eventListener = eventEmitter.addListener('lyric-line-play', event => {
    handler(event as { text: string, extendedLyrics: string[] })
  })

  return () => {
    eventListener.remove()
  }
}
