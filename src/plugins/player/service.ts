/* eslint-disable @typescript-eslint/no-misused-promises */
import TrackPlayer, { State as TPState, Event as TPEvent } from 'react-native-track-player'
// import { store } from '@/store'
// import { action as playerAction, STATUS } from '@/store/modules/player'
import { isTempId, isEmpty, updateOptions } from './utils'
import { PLAY_MODES, registerNotificationListeners, isCurrentMusicLiked } from './notification'
// import { play as lrcPlay, pause as lrcPause } from '@/core/lyric'
import { exitApp, updateSetting } from '@/core/common'
import { getCurrentTrackId } from './playList'
import { collectMusic, pause, play, playNext, playPrev, uncollectMusic } from '@/core/player/player'
import settingState from '@/store/setting/state'
import { log } from '@/utils/log'

let isInitialized = false

// let retryTrack: LX.Player.Track | null = null
// let retryGetUrlId: string | null = null
// let retryGetUrlNum = 0
// let errorTime = 0
// let prevDuration = 0
// let isPlaying = false

// 销毁播放器并退出
const handleExitApp = async(reason: string) => {
  global.lx.isPlayedStop = false
  exitApp(reason)
}

// 通知栏自定义按钮（native 侧 MusicService 拦截 PendingIntent 后 emit 的 remote-* 事件）
const REMOTE_FAVORITE = 'remote-favorite' as unknown as TPEvent
const REMOTE_LOOP = 'remote-loop' as unknown as TPEvent

/**
 * 通知栏「收藏」按钮：收藏 / 取消收藏当前播放歌曲。
 * 云盘下载歌曲（Download.ListItem）由 collectMusic / uncollectMusic 内部拆 metadata 处理。
 * 收藏状态变化后 LOVE 列表会触发 list_music_add / list_music_remove，
 * notification.ts 里注册的监听会再刷新一次通知图标，这里先同步刷新一次让点击反馈更即时。
 */
const handleRemoteFavorite = () => {
  if (!global.lx.playerStatus.isInitialized) return
  if (isCurrentMusicLiked()) {
    uncollectMusic()
  } else {
    collectMusic()
  }
  void updateOptions()
}

/**
 * 通知栏「循环」按钮：按播放器页相同的顺序切换播放模式
 * （列表循环 → 随机 → 单曲循环 → 顺序），改完 setting 后刷新通知图标。
 */
const handleRemoteLoop = () => {
  if (!global.lx.playerStatus.isInitialized) return
  const current = settingState.setting['player.togglePlayMethod']
  const index = PLAY_MODES.indexOf(current as typeof PLAY_MODES[number])
  const next = PLAY_MODES[(index + 1) % PLAY_MODES.length]
  updateSetting({ 'player.togglePlayMethod': next })
  // configUpdated 监听也会刷新，这里直接刷新让通知按钮状态跟手
  void updateOptions()
}


const registerPlaybackService = async() => {
  if (isInitialized) return

  // 通知栏状态同步：主题色 / 收藏状态 / 播放模式变化时重新下发 options
  registerNotificationListeners(updateOptions)

  TrackPlayer.addEventListener(TPEvent.RemotePlay, () => {
    // console.log('remote-play')
    play()
  })

  TrackPlayer.addEventListener(TPEvent.RemotePause, () => {
    // console.log('remote-pause')
    void pause()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteNext, () => {
    // console.log('remote-next')
    void playNext()
  })

  TrackPlayer.addEventListener(TPEvent.RemotePrevious, () => {
    // console.log('remote-previous')
    void playPrev()
  })

  // 通知栏展开视图的自定义按钮（收藏 / 循环）
  TrackPlayer.addEventListener(REMOTE_FAVORITE, () => {
    // console.log('remote-favorite')
    handleRemoteFavorite()
  })

  TrackPlayer.addEventListener(REMOTE_LOOP, () => {
    // console.log('remote-loop')
    handleRemoteLoop()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteStop, () => {
    // console.log('remote-stop')
    void handleExitApp('Remote Stop')
  })

  // TrackPlayer.addEventListener(TPEvent.RemoteDuck, async({ permanent, paused, ducking }) => {
  //   console.log('remote-duck')
  //   if (paused) {
  //     store.dispatch(playerAction.setStatus({ status: STATUS.pause, text: '已暂停' }))
  //     lrcPause()
  //   } else {
  //     store.dispatch(playerAction.setStatus({ status: STATUS.playing, text: '播放中...' }))
  //     TrackPlayer.getPosition().then(position => {
  //       lrcPlay(position * 1000)
  //     })
  //   }
  // })

  TrackPlayer.addEventListener(TPEvent.PlaybackError, async(err: any) => {
    // 播放错误要留痕（设置 → 其他 → 日志），否则线上出问题查不到原因
    log.error('PlaybackError', err)
    global.app_event.error()
    global.app_event.playerError()
  })

  TrackPlayer.addEventListener(TPEvent.RemoteSeek, async({ position }) => {
    global.app_event.setProgress(position as number)
  })

  TrackPlayer.addEventListener(TPEvent.PlaybackState, async info => {
    if (global.lx.gettingUrlId || isTempId()) return
    // let currentIsPlaying = false

    switch (info.state) {
      case TPState.None:
        // console.log('state', 'State.NONE')
        break
      case TPState.Ready:
      case TPState.Stopped:
      case TPState.Paused:
        global.app_event.playerPause()
        global.app_event.pause()
        break
      case TPState.Playing:
        global.app_event.playerPlaying()
        global.app_event.play()
        break
      case TPState.Buffering:
        global.app_event.pause()
        global.app_event.playerWaiting()
        break
      case TPState.Connecting:
        global.app_event.playerLoadstart()
        break
      default:
        // console.log('playback-state', info)
        break
    }
    if (global.lx.isPlayedStop) return handleExitApp('Timeout Exit')

    // console.log('currentIsPlaying', currentIsPlaying, global.lx.playInfo.isPlaying)
    // void updateMetaData(global.lx.store_playMusicInfo.musicInfo, currentIsPlaying)
  })
  TrackPlayer.addEventListener(TPEvent.PlaybackTrackChanged, async info => {
    // console.log('PlaybackTrackChanged====>', info)
    global.lx.playerTrackId = await getCurrentTrackId()
    // 切歌后通知栏的收藏按钮图标要跟着当前歌曲换掉（不同歌曲收藏状态可能不同）
    void updateOptions()
    if (info.track == null) return
    if (global.lx.isPlayedStop) return handleExitApp('Timeout Exit')

    // console.log('global.lx.playerTrackId====>', global.lx.playerTrackId)
    if (isEmpty()) {
      // console.log('====TEMP PAUSE====')
      await TrackPlayer.pause()
      global.app_event.playerPause()
      global.app_event.pause()
      global.app_event.playerEnded()
      global.app_event.playerEmptied()
      // if (retryTrack) {
      //   if (retryTrack.musicId == retryGetUrlId) {
      //     if (++retryGetUrlNum > 1) {
      //       store.dispatch(playerAction.playNext(true))
      //       retryGetUrlId = null
      //       retryTrack = null
      //       return
      //     }
      //   } else {
      //     retryGetUrlId = retryTrack.musicId
      //     retryGetUrlNum = 0
      //   }
      //   store.dispatch(playerAction.refreshMusicUrl(global.lx.playInfo.currentPlayMusicInfo, errorTime))
      // } else {
      //   store.dispatch(playerAction.playNext(true))
      // }
    }
  //   // if (!info.nextTrack) return
  //   // if (info.track) {
  //   //   const track = info.track.substring(0, info.track.lastIndexOf('__//'))
  //   //   const nextTrack = info.track.substring(0, info.nextTrack.lastIndexOf('__//'))
  //   //   console.log(nextTrack, track)
  //   //   if (nextTrack == track) return
  //   // }
  //   // const track = await TrackPlayer.getTrack(info.nextTrack)
  //   // if (!track) return
  //   // let newTrack
  //   // if (track.url == defaultUrl) {
  //   //   TrackPlayer.pause().then(async() => {
  //   //     isRefreshUrl = true
  //   //     retryGetUrlId = track.id
  //   //     retryGetUrlNum = 0
  //   //     try {
  //   //       newTrack = await updateTrackUrl(track)
  //   //       console.log('++++newTrack++++', newTrack)
  //   //     } catch (error) {
  //   //       console.log('error', error)
  //   //       if (error.message != '跳过播放') TrackPlayer.skipToNext()
  //   //       isRefreshUrl = false
  //   //       retryGetUrlId = null
  //   //       return
  //   //     }
  //   //     retryGetUrlId = null
  //   //     isRefreshUrl = false
  //   //     console.log(await TrackPlayer.getQueue(), null, 2)
  //   //     await TrackPlayer.play()
  //   //   })
  //   // }
  //   // store.dispatch(playerAction.playNext())
  })
  // TrackPlayer.addEventListener('playback-queue-ended', async info => {
  //   // console.log('playback-queue-ended', info)
  //   store.dispatch(playerAction.playNext())
  //   // if (!info.nextTrack) return
  //   // const track = await TrackPlayer.getTrack(info.nextTrack)
  //   // if (!track) return
  //   // // if (track.url == defaultUrl) {
  //   // //   TrackPlayer.pause()
  //   // //   getMusicUrl(track.original).then(url => {
  //   // //     TrackPlayer.updateMetadataForTrack(info.nextTrack, {
  //   // //       url,
  //   // //     })
  //   // //     TrackPlayer.play()
  //   // //   })
  //   // // }
  //   // if (!track.artwork) {
  //   //   getMusicPic(track.original).then(url => {
  //   //     console.log(url)
  //   //     TrackPlayer.updateMetadataForTrack(info.nextTrack, {
  //   //       artwork: url,
  //   //     })
  //   //   })
  //   // }
  // })
  // TrackPlayer.addEventListener('playback-destroy', async() => {
  //   console.log('playback-destroy')
  //   store.dispatch(playerAction.destroy())
  // })
  isInitialized = true
}


export default () => {
  if (global.lx.playerStatus.isRegisteredService) return
  TrackPlayer.registerPlaybackService(() => registerPlaybackService)
  global.lx.playerStatus.isRegisteredService = true
}
