import { addPlayedList, clearPlayedList } from '@/core/player/playedList'
import { pause, playNext } from '@/core/player/player'
import { setStatusText, setIsPlay } from '@/core/player/playStatus'
// import { resetPlayerMusicInfo } from '@/core/player/playInfo'
import { setStop } from '@/plugins/player'
import { delayUpdateMusicInfo } from '@/plugins/player/playList'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { syncMusicWidget } from '@/utils/widget'
import themeState from '@/store/theme/state'
import BackgroundTimer from 'react-native-background-timer'
import { getCurrentLyricText } from '@/plugins/lyric'


export default async(setting: LX.AppSetting) => {
  let widgetTimer: number | null = null
  const stopWidgetTimer = () => {
    if (widgetTimer != null) {
      BackgroundTimer.clearInterval(widgetTimer)
      widgetTimer = null
    }
  }
  const startWidgetTimer = () => {
    if (widgetTimer != null) return
    widgetTimer = BackgroundTimer.setInterval(syncWidget, 5000)
  }

  const syncWidget = () => {
    // App 启动/恢复尚未拿到播放信息时不要用空值覆盖桌面小组件
    if (!playerState.musicInfo.id || !playerState.musicInfo.name) return
    const duration = playerState.progress.maxPlayTime
    const progress = duration > 0 ? playerState.progress.nowPlayTime / duration : 0
    syncMusicWidget(playerState.musicInfo.name ?? '', playerState.musicInfo.singer ?? '', playerState.isPlay, playerState.musicInfo.pic ?? '', themeState.theme.isDark, themeState.theme['c-primary'], progress, getCurrentLyricText())
  }

  const setPlayStatus = () => {
    setIsPlay(true)
    syncWidget()
    startWidgetTimer()
  }
  const setPauseStatus = () => {
    setIsPlay(false)
    stopWidgetTimer()
    syncWidget()
    if (global.lx.isPlayedStop) void pause()
  }

  const handleEnded = () => {
    // setTimeout(() => {
    if (global.lx.isPlayedStop) {
      setStatusText(global.i18n.t('player__end'))
      return
    }
    // resetPlayerMusicInfo()
    // global.app_event.stop()
    global.app_event.setProgress(0)
    setStatusText(global.i18n.t('player__end'))
    void playNext(true)
    // })
  }

  const setStopStatus = () => {
    setIsPlay(false)
    stopWidgetTimer()
    syncWidget()
    setStatusText('')
    void setStop()
  }

  const updatePic = () => {
    syncWidget()
    if (!settingState.setting['player.isShowNotificationImage']) return
    if (playerState.playMusicInfo.musicInfo && playerState.musicInfo.pic) {
      delayUpdateMusicInfo(playerState.musicInfo)
    }
  }

  const handleConfigUpdated: typeof global.state_event.configUpdated = (keys, settings) => {
    if (keys.includes('player.togglePlayMethod')) {
      const newValue = settings['player.togglePlayMethod']
      if (playerState.playedList.length) clearPlayedList()
      const playMusicInfo = playerState.playMusicInfo
      if (newValue == 'random' && playMusicInfo.musicInfo && !playMusicInfo.isTempPlay) addPlayedList({ ...(playMusicInfo as LX.Player.PlayMusicInfo) })
    }
  }


  global.app_event.on('musicToggled', syncWidget)
  global.app_event.on('play', setPlayStatus)
  global.app_event.on('pause', setPauseStatus)
  global.app_event.on('error', setPauseStatus)
  global.app_event.on('stop', setStopStatus)
  global.app_event.on('playerEnded', handleEnded)
  global.app_event.on('picUpdated', updatePic)
  global.state_event.on('configUpdated', handleConfigUpdated)
  global.state_event.on('themeUpdated', syncWidget)
}
