import {
  setSendLyricTextEvent,
  setLyric,
  play,
  pause,
  setPlaybackRate,
  toggleTranslation,
  toggleRoma,
  onLyricLinePlay,
} from '@/utils/nativeModules/lyricRemote'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import { tranditionalize } from '@/utils/simplify-chinese-main'
import { getPosition } from '@/plugins/player'

export { onLyricLinePlay }

/**
 * 开启/关闭蓝牙歌词发送。
 *
 * 开启时把当前歌词与播放进度推给原生，原生通过媒体会话把当前行发出去；
 * 关闭时只是停止发送，不影响播放器本身。
 */
export const showRemoteLyric = async(isSend: boolean) => {
  await setSendLyricTextEvent(isSend)
  if (isSend) {
    let lrc = playerState.musicInfo.lrc ?? ''
    let tlrc = playerState.musicInfo.tlrc ?? ''
    let rlrc = playerState.musicInfo.rlrc ?? ''
    if (settingState.setting['player.isS2t']) {
      lrc = tranditionalize(lrc)
      tlrc = tranditionalize(tlrc)
    }
    await setLyric(lrc, tlrc, rlrc)
    if (playerState.isPlay && !global.lx.gettingUrlId) {
      void getPosition().then(position => {
        void play(position * 1000)
      })
    }
  }
}

export const setRemoteLyric = setLyric
export const playRemoteLyric = play
export const pauseRemoteLyric = pause
export const setRemoteLyricPlaybackRate = setPlaybackRate
export const toggleRemoteLyricTranslation = toggleTranslation
export const toggleRemoteLyricRoma = toggleRoma
