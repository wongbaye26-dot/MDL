import TrackPlayer from 'react-native-track-player'
import { updateOptions, setVolume, setPlaybackRate, migratePlayerCache } from './utils'

// const listenEvent = () => {
//   TrackPlayer.addEventListener('playback-error', err => {
//     console.log('playback-error', err)
//   })
//   TrackPlayer.addEventListener('playback-state', info => {
//     console.log('playback-state', info)
//   })
//   TrackPlayer.addEventListener('playback-track-changed', info => {
//     console.log('playback-track-changed', info)
//   })
//   TrackPlayer.addEventListener('playback-queue-ended', info => {
//     console.log('playback-queue-ended', info)
//   })
// }

const initial = async({ volume, playRate, cacheSize, isHandleAudioFocus, isEnableAudioOffload }: {
  volume: number
  playRate: number
  cacheSize: number
  isHandleAudioFocus: boolean
  isEnableAudioOffload: boolean
}) => {
  if (global.lx.playerStatus.isIniting || global.lx.playerStatus.isInitialized) return
  global.lx.playerStatus.isIniting = true
  await migratePlayerCache()
  /*
   * 缓冲参数（单位：秒，原生会换算成 ExoPlayer 的毫秒）。
   *
   * 原来只给了 maxBuffer: 1000 —— 相当于允许提前缓冲 1000 秒，
   * 播放器会把后面几十首的流量都先拉下来：内存压力大、弱网时首播更慢，
   * 还会挤占当前歌曲的带宽。这里改成一组明确的「快速起播 + 够抗抖动」的值：
   *   playBuffer 1.5s：缓冲够 1.5 秒就开始出声（ExoPlayer 默认 2.5 秒）
   *   minBuffer 15s：低于 15 秒时继续拉流
   *   maxBuffer 45s：最多提前缓冲 45 秒，避免整张专辑提前下载
   *   backBuffer 30s：回退 30 秒以内不用重新请求
   */
  await TrackPlayer.setupPlayer({
    maxCacheSize: cacheSize * 1024,
    minBuffer: 15,
    maxBuffer: 45,
    playBuffer: 1.5,
    backBuffer: 30,
    // Android 由 playBuffer 控制起播；iOS 关掉可减少「等缓冲」的延迟
    waitForBuffer: false,
    handleAudioFocus: isHandleAudioFocus,
    audioOffload: isEnableAudioOffload,
    autoUpdateMetadata: false,
  })
  global.lx.playerStatus.isInitialized = true
  global.lx.playerStatus.isIniting = false
  await updateOptions()
  await setVolume(volume)
  await setPlaybackRate(playRate)
  // listenEvent()
}


const isInitialized = () => global.lx.playerStatus.isInitialized


export {
  initial,
  isInitialized,
  setVolume,
  setPlaybackRate,
}

export {
  setResource,
  setPause,
  setPlay,
  setCurrentTime,
  getDuration,
  setStop,
  resetPlay,
  getPosition,
  updateMetaData,
  onStateChange,
  isEmpty,
  useBufferProgress,
  initTrackInfo,
  pauseLocalPlayback,
} from './utils'
