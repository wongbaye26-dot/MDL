import TrackPlayer, { Event, RepeatMode, State } from 'react-native-track-player'
import BackgroundTimer from 'react-native-background-timer'
import { playMusic as handlePlayMusic } from './playList'
import { buildNotificationOptions } from './notification'
import { existsFile, moveFile, privateStorageDirectoryPath, temporaryDirectoryPath } from '@/utils/fs'
import { toast } from '@/utils/tools'
// import { PlayerMusicInfo } from '@/store/modules/player/playInfo'


export { useBufferProgress } from './hook'

const emptyIdRxp = /\/\/default$/
const tempIdRxp = /\/\/default$|\/\/default\/\/restorePlay$/
export const isEmpty = (trackId = global.lx.playerTrackId) => {
  // console.log(trackId)
  return !trackId || emptyIdRxp.test(trackId)
}
export const isTempId = (trackId = global.lx.playerTrackId) => !trackId || tempIdRxp.test(trackId)

// export const replacePlayTrack = async(newTrack, oldTrack) => {
//   console.log('replaceTrack')
//   await TrackPlayer.add(newTrack)
//   await TrackPlayer.skip(newTrack.id)
//   await TrackPlayer.remove(oldTrack.id)
// }

// let timeout
// let isFirstPlay = true
// const updateInfo = async track => {
//   if (isFirstPlay) {
//     // timeout = setTimeout(() => {
//     await delayUpdateMusicInfo(track)
//     isFirstPlay = false
//     // }, 500)
//   }
// }


// 解决快速切歌导致的通知栏歌曲信息与当前播放歌曲对不上的问题
// const debouncePlayMusicTools = {
//   prevPlayMusicPromise: Promise.resolve(),
//   trackInfo: {},
//   isDelayUpdate: false,
//   isDebounced: false,
//   delay: 1000,
//   delayTimer: null,
//   debounce(fn, delay = 100) {
//     let timer = null
//     let _tracks = null
//     let _time = null
//     return (tracks, time) => {
//       if (!this.isDebounced && _tracks != null) this.isDebounced = true
//       _tracks = tracks
//       _time = time
//       if (timer) {
//         BackgroundTimer.clearTimeout(timer)
//         timer = null
//       }
//       if (this.isDelayUpdate) {
//         if (this.updateDelayTimer) {
//           BackgroundTimer.clearTimeout(this.updateDelayTimer)
//           this.updateDelayTimer = null
//         }
//         timer = BackgroundTimer.setTimeout(() => {
//           timer = null
//           let tracks = _tracks
//           let time = _time
//           _tracks = null
//           _time = null
//           this.isDelayUpdate = false
//           fn(tracks, time)
//         }, delay)
//       } else {
//         this.isDelayUpdate = true
//         fn(tracks, time)
//         this.updateDelayTimer = BackgroundTimer.setTimeout(() => {
//           this.updateDelayTimer = null
//           this.isDelayUpdate = false
//         }, this.delay)
//       }
//     }
//   },
//   delayUpdateMusicInfo() {
//     if (this.delayTimer) BackgroundTimer.clearTimeout(this.delayTimer)
//     this.delayTimer = BackgroundTimer.setTimeout(() => {
//       this.delayTimer = null
//       if (this.trackInfo.tracks && this.trackInfo.tracks.length) delayUpdateMusicInfo(this.trackInfo.tracks[0])
//     }, this.delay)
//   },
//   init() {
//     return this.debounce((tracks, time) => {
//       tracks = [...tracks]
//       this.trackInfo.tracks = tracks
//       this.trackInfo.time = time
//       return this.prevPlayMusicPromise.then(() => {
//         // console.log('run')
//         if (this.trackInfo.tracks === tracks) {
//           this.prevPlayMusicPromise = handlePlayMusic(tracks, time).then(() => {
//             if (this.isDebounced) {
//               this.delayUpdateMusicInfo()
//               this.isDebounced = false
//             }
//           })
//         }
//       })
//     }, 200)
//   },
// }

/**
 * 切歌去抖：短时间内连续两次 setResource 时，只保留最后一次。
 *
 * 原来延迟 800ms、判定窗口 500ms —— 用户点一下播放要愣将近一秒才出声，
 * 这就是「点击播放键过几秒才开始」里最稳定的那一段。
 * 缩短到 250ms：仍然能吃掉快速连点产生的重复请求，但听感上是即时的。
 */
const playMusic = ((fn: (musicInfo: LX.Player.PlayMusic, url: string, time: number) => void, delay = 250) => {
  let delayTimer: number | null = null
  let isDelayRun = false
  let timer: number | null = null
  let _musicInfo: LX.Player.PlayMusic | null = null
  let _url = ''
  let _time = 0
  return (musicInfo: LX.Player.PlayMusic, url: string, time: number) => {
    _musicInfo = musicInfo
    _url = url
    _time = time
    if (timer) {
      BackgroundTimer.clearTimeout(timer)
      timer = null
    }
    if (isDelayRun) {
      if (delayTimer) {
        BackgroundTimer.clearTimeout(delayTimer)
        delayTimer = null
      }
      timer = BackgroundTimer.setTimeout(() => {
        timer = null
        let musicInfo = _musicInfo
        let url = _url
        let time = _time
        _musicInfo = null
        _url = ''
        _time = 0
        isDelayRun = false
        fn(musicInfo!, url, time)
      }, delay)
    } else {
      isDelayRun = true
      fn(musicInfo, url, time)
      delayTimer = BackgroundTimer.setTimeout(() => {
        delayTimer = null
        isDelayRun = false
      }, 300)
    }
  }
})((musicInfo, url, time) => {
  handlePlayMusic(musicInfo, url, time)
})

/** 本地文件路径需要转成 file:// 才能交给播放器 */
const toPlayableUrl = (url: string) => (url && url.startsWith('/')) ? `file://${url}` : url

export const setResource = (musicInfo: LX.Player.PlayMusic, url: string, duration?: number) => {
  playMusic(musicInfo, toPlayableUrl(url), duration ?? 0)
}

export const setPlay = async() => TrackPlayer.play()
export const getPosition = async() => TrackPlayer.getPosition()
export const getDuration = async() => TrackPlayer.getDuration()
export const setStop = async() => {
  await TrackPlayer.stop()
  if (!isEmpty()) await TrackPlayer.skipToNext()
}
export const setLoop = async(loop: boolean) => TrackPlayer.setRepeatMode(loop ? RepeatMode.Off : RepeatMode.Track)

export const setPause = async() => TrackPlayer.pause()
// export const skipToNext = () => TrackPlayer.skipToNext()
export const setCurrentTime = async(time: number) => TrackPlayer.seekTo(time)
export const setVolume = async(num: number) => TrackPlayer.setVolume(num)
export const setPlaybackRate = async(num: number) => TrackPlayer.setRate(num)
export interface NowPlayingTitles {
  title?: string
  artist?: string
  album?: string
  lyric?: string
}
export const updateNowPlayingTitles = async(titles: NowPlayingTitles) => {
  // console.log('set playing titles', titles)
  return TrackPlayer.updateNowPlayingTitles(titles)
}

export const resetPlay = async() => Promise.all([setPause(), setCurrentTime(0)])

export const isCached = async(url: string) => TrackPlayer.isCached(url)
export const getCacheSize = async() => TrackPlayer.getCacheSize()
export const clearCache = async() => TrackPlayer.clearCache()
export const migratePlayerCache = async() => {
  const newCachePath = privateStorageDirectoryPath + '/TrackPlayer'
  if (await existsFile(newCachePath)) return
  const oldCachePath = temporaryDirectoryPath + '/TrackPlayer'
  if (!await existsFile(oldCachePath)) return
  let timeout: number | null = BackgroundTimer.setTimeout(() => {
    timeout = null
    toast(global.i18n.t('player_cache_migrating'), 'long')
  }, 2_000)
  await moveFile(oldCachePath, newCachePath).finally(() => {
    if (timeout) BackgroundTimer.clearTimeout(timeout)
  })
}

export const destroy = async() => {
  if (global.lx.playerStatus.isIniting || !global.lx.playerStatus.isInitialized) return
  await TrackPlayer.destroy()
  global.lx.playerStatus.isInitialized = false
}

type PlayStatus = 'None' | 'Ready' | 'Playing' | 'Paused' | 'Stopped' | 'Buffering' | 'Connecting'

export const onStateChange = async(listener: (state: PlayStatus) => void) => {
  const sub = TrackPlayer.addEventListener(Event.PlaybackState, state => {
    let _state: PlayStatus
    switch (state) {
      case State.Ready:
        _state = 'Ready'
        break
      case State.Playing:
        _state = 'Playing'
        break
      case State.Paused:
        _state = 'Paused'
        break
      case State.Stopped:
        _state = 'Stopped'
        break
      case State.Buffering:
        _state = 'Buffering'
        break
      case State.Connecting:
        _state = 'Connecting'
        break
      case State.None:
      default:
        _state = 'None'
        break
    }
    listener(_state)
  })

  return () => {
    sub.remove()
  }
}

/**
 * Subscription player state chuange event
 * @param options state change event
 * @returns remove event function
 */
// export const playState = callback => TrackPlayer.addEventListener('playback-state', callback)

/**
 * 下发通知栏 / 锁屏媒体卡片的 options。
 *
 * 具体内容（主题主色、收藏 / 循环按钮图标、compact 的上一首等）在 ./notification 里
 * 按当前主题、收藏状态、播放模式生成；切歌 / 收藏变化 / 播放模式变化 / 主题切换时
 * 重新调用本方法即可让 native 重绘通知。
 */
export const updateOptions = async() => {
  // 播放器还没初始化时 native 侧还没有连上 MusicService，下发没有意义
  if (!global.lx.playerStatus.isInitialized) return
  return TrackPlayer.updateOptions(buildNotificationOptions())
}

// export const setMaxCache = async size => {
//   // const currentTrack = await TrackPlayer.getCurrentTrack()
//   // if (!currentTrack) return
//   // console.log(currentTrack)
//   // const currentTime = await TrackPlayer.getPosition()
//   // const state = await TrackPlayer.getState()
//   // await stop()
//   // await TrackPlayer.destroy()
//   // await TrackPlayer.setupPlayer({ maxCacheSize: size * 1024, maxBuffer: 1000, waitForBuffer: true })
//   // await updateOptions()
//   // await TrackPlayer.seekTo(currentTime)
//   // switch (state) {
//   //   case TrackPlayer.STATE_PLAYING:
//   //   case TrackPlayer.STATE_BUFFERING:
//   //     await TrackPlayer.play()
//   //     break
//   //   default:
//   //     break
//   // }
// }

// export {
//   useProgress,
// }

export { updateMetaData, initTrackInfo } from './playList'
