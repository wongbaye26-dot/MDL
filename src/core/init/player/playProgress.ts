import { updateListMusics } from '@/core/list'
import { setMaxplayTime, setNowPlayTime } from '@/core/player/progress'
import { setCurrentTime, getDuration, getPosition } from '@/plugins/player'
import { recordPlaybackTick } from '@/core/player/listenStats'
import { shouldAdvanceCue } from '@/core/localLibrary/cuePlayback'
import { playNext } from '@/core/player/player'
import { formatPlayTime2 } from '@/utils/common'
import { savePlayInfo } from '@/utils/data'
import { throttleBackgroundTimer } from '@/utils/tools'
import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { onScreenStateChange } from '@/utils/nativeModules/utils'
import { AppState } from 'react-native'

const delaySavePlayInfo = throttleBackgroundTimer(() => {
  void savePlayInfo({
    time: playerState.progress.nowPlayTime,
    maxTime: playerState.progress.maxPlayTime,
    listId: playerState.playMusicInfo.listId!,
    index: playerState.playInfo.playIndex,
  })
}, 2000)

/** 在线歌曲的 interval 是 "04:13" 文本；兜底时长用 */
const parseIntervalSeconds = (interval?: string | number) => {
  if (typeof interval === 'number') return interval > 0 ? interval : 0
  const m = /^(\d+):(\d+)$/.exec(interval ?? '')
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

export default () => {
  // const updateMusicInfo = useCommit('list', 'updateMusicInfo')

  let updateTimeout: number | null = null

  let isScreenOn = true
  let cueAdvancing = false
  /** 用户拖动进度后短暂屏蔽轮询回写，并补一次 seek，避免加载竞态把进度重置到 0 */
  let seekHoldUntil = 0

  const getCurrentTime = () => {
    if (Date.now() < seekHoldUntil) return
    let id = playerState.musicInfo.id
    void getPosition().then(position => {
      if (position == null || id != playerState.musicInfo.id || Date.now() < seekHoldUntil) return
      setNowPlayTime(position)
      recordPlaybackTick(position)
      if (!playerState.isPlay) return
      const current = playerState.playMusicInfo.musicInfo
      if (!cueAdvancing && current && 'meta' in current && current.meta && 'filePath' in current.meta && shouldAdvanceCue(current.meta, position * 1000)) {
        cueAdvancing = true
        void playNext(true).finally(() => { cueAdvancing = false })
        return
      }

      if (settingState.setting['player.isSavePlayTime'] && !playerState.playMusicInfo.isTempPlay && isScreenOn) {
        delaySavePlayInfo()
      }
    })
  }
  const getMaxTime = async() => {
    const duration = await getDuration()
    const current = playerState.playMusicInfo.musicInfo
    const fallback = current && 'interval' in current
      ? parseIntervalSeconds((current as { interval?: string | number }).interval)
      : 0
    const max = Number.isFinite(duration) && duration > 0 ? duration : fallback
    if (max > 0) setMaxplayTime(max)

    if (playerState.playMusicInfo.musicInfo && 'source' in playerState.playMusicInfo.musicInfo && !playerState.playMusicInfo.musicInfo.interval) {
      // console.log(formatPlayTime2(playProgress.maxPlayTime))

      if (playerState.playMusicInfo.listId) {
        void updateListMusics([{
          id: playerState.playMusicInfo.listId,
          musicInfo: {
            ...playerState.playMusicInfo.musicInfo,
            interval: formatPlayTime2(playerState.progress.maxPlayTime),
          },
        }])
      }
    }
  }

  const clearUpdateTimeout = () => {
    if (!updateTimeout) return
    BackgroundTimer.clearInterval(updateTimeout)
    updateTimeout = null
  }
  const startUpdateTimeout = () => {
    if (!isScreenOn) return
    clearUpdateTimeout()
    updateTimeout = BackgroundTimer.setInterval(() => {
      getCurrentTime()
    }, 1000 / settingState.setting['player.playbackRate'])
    getCurrentTime()
  }

  const setProgress = (time: number, maxTime?: number) => {
    if (!playerState.musicInfo.id) return
    // console.log('setProgress', time, maxTime)
    const seekTime = time
    seekHoldUntil = Date.now() + 900
    setNowPlayTime(time)
    void setCurrentTime(time)
    // 起播/换源的回调可能稍后才执行 seek(0)，900ms 内再补齐一次用户目标进度
    BackgroundTimer.setTimeout(() => {
      if (Date.now() < seekHoldUntil - 350) return
      if (playerState.musicInfo.id && Math.abs(playerState.progress.nowPlayTime - seekTime) < 1.5) {
        void setCurrentTime(seekTime)
      }
    }, 650)

    if (maxTime != null) setMaxplayTime(maxTime)

    // if (!isPlay) audio.play()
  }


  const handlePlay = () => {
    seekHoldUntil = 0
    void getMaxTime()
    // prevProgressStatus = 'normal'
    // handleSetTaskBarState(playProgress.progress, prevProgressStatus)
    startUpdateTimeout()
  }
  const saveNow = () => {
    if (!settingState.setting['player.isSavePlayTime']) return
    if (!playerState.playMusicInfo.listId || playerState.playMusicInfo.isTempPlay) return
    if (!playerState.playMusicInfo.musicInfo) return
    void savePlayInfo({
      time: playerState.progress.nowPlayTime,
      maxTime: playerState.progress.maxPlayTime,
      listId: playerState.playMusicInfo.listId,
      index: playerState.playInfo.playIndex,
    })
  }

  const handlePause = () => {
    // prevProgressStatus = 'paused'
    // handleSetTaskBarState(playProgress.progress, prevProgressStatus)
    // clearBufferTimeout()
    clearUpdateTimeout()
    // 暂停/退后台时立刻落一次队列位置，冷启动能恢复到暂停点
    saveNow()
  }

  const handleStop = () => {
    clearUpdateTimeout()
    setNowPlayTime(0)
    setMaxplayTime(0)
    // prevProgressStatus = 'none'
    // handleSetTaskBarState(playProgress.progress, prevProgressStatus)
  }

  const handleError = () => {
    // if (!restorePlayTime) restorePlayTime = getCurrentTime() // 记录出错的播放时间
    // console.log('handleError')
    // prevProgressStatus = 'error'
    // handleSetTaskBarState(playProgress.progress, prevProgressStatus)
    clearUpdateTimeout()
  }


  const handleSetPlayInfo = () => {
    // restorePlayTime = playProgress.nowPlayTime
    // void setCurrentTime(playerState.progress.nowPlayTime)
    // setMaxplayTime(playProgress.maxPlayTime)
    handlePause()
    if (!playerState.playMusicInfo.isTempPlay) {
      void savePlayInfo({
        time: playerState.progress.nowPlayTime,
        maxTime: playerState.progress.maxPlayTime,
        listId: playerState.playMusicInfo.listId!,
        index: playerState.playInfo.playIndex,
      })
    }
  }

  // watch(() => playerState.progress.nowPlayTime, (newValue, oldValue) => {
  //   if (settingState.setting['player.isSavePlayTime'] && !playMusicInfo.isTempPlay) {
  //     delaySavePlayInfo({
  //       time: newValue,
  //       maxTime: playerState.progress.maxPlayTime,
  //       listId: playMusicInfo.listId as string,
  //       index: playInfo.playIndex,
  //     })
  //   }
  // })
  // watch(() => playerState.progress.maxPlayTime, maxPlayTime => {
  //   if (!playMusicInfo.isTempPlay) {
  //     delaySavePlayInfo({
  //       time: playerState.progress.nowPlayTime,
  //       maxTime: maxPlayTime,
  //       listId: playMusicInfo.listId as string,
  //       index: playInfo.playIndex,
  //     })
  //   }
  // })

  const handleConfigUpdated: typeof global.state_event.configUpdated = (keys, settings) => {
    if (keys.includes('player.playbackRate')) startUpdateTimeout()
  }

  const handleScreenStateChanged: Parameters<typeof onScreenStateChange>[0] = (state) => {
    isScreenOn = state == 'ON'
    if (isScreenOn) {
      if (playerState.isPlay) startUpdateTimeout()
    } else clearUpdateTimeout()
  }

  // 修复在某些设备上屏幕状态改变事件未触发导致的进度条未更新的问题
  AppState.addEventListener('change', (state) => {
    if (state == 'active' && !isScreenOn) handleScreenStateChanged('ON')
    if (state == 'active' && playerState.isPlay) startUpdateTimeout()
    // 退到后台可能被杀进程：先落一次队列/进度
    if (state !== 'active') saveNow()
  })

  global.app_event.on('play', handlePlay)
  global.app_event.on('pause', handlePause)
  global.app_event.on('stop', handleStop)
  global.app_event.on('error', handleError)
  global.app_event.on('setProgress', setProgress)
  // global.app_event.on(eventPlayerNames.restorePlay, handleRestorePlay)
  // global.app_event.on('playerLoadeddata', handleLoadeddata)
  // global.app_event.on('playerCanplay', handleCanplay)
  // global.app_event.on('playerWaiting', handleWating)
  // global.app_event.on('playerEmptied', handleEmpied)
  global.app_event.on('musicToggled', handleSetPlayInfo)
  global.state_event.on('configUpdated', handleConfigUpdated)

  onScreenStateChange(handleScreenStateChanged)
  // 冷启动/恢复播放时补启动轮询，避免错过 play 事件后进度条不动
  if (playerState.isPlay) startUpdateTimeout()
}
