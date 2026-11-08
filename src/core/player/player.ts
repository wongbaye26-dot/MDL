import { isInitialized, initial as playerInitial, isEmpty, setPause, setPlay, setResource, setStop, initTrackInfo, setVolume } from '@/plugins/player'
import {
  setStatusText,
} from '@/core/player/playStatus'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { normalizeMusicInfo } from '@/utils/musicInfo'
import { getLocalMusicListSync } from '@/core/localMusic'
import {
  getList,
  setPlayMusicInfo,
  setMusicInfo,
  setPlayListId,
} from '@/core/player/playInfo'
import {
  clearPlayedList,
  addPlayedList,
  removePlayedList,
} from '@/core/player/playedList'
import {
  clearTempPlayeList,
  removeTempPlayList,
} from '@/core/player/tempPlayList'
import { addRecentPlay } from '@/core/player/recentPlay'
import { resolveMusicUrl, getPicPath, getLyricInfo, type ResolvedMusicUrl } from '@/core/music'
import { getPlayQuality, getSourceName } from '@/core/music/utils'
import { requestMsg } from '@/utils/message'
import { getRandom } from '@/utils/common'
import { filterList } from './utils'
import { getCueStartSeconds } from '@/core/localLibrary/cuePlayback'
import BackgroundTimer from 'react-native-background-timer'
import { AppState } from 'react-native'
import { checkIgnoringBatteryOptimization, checkNotificationPermission, debounceBackgroundTimer, toast } from '@/utils/tools'
import { LIST_IDS } from '@/config/constant'
import { addListMusics, removeListMusics } from '@/core/list'
import { addDislikeInfo } from '@/core/dislikeList'
import { log } from '@/utils/log'

// import { checkMusicFileAvailable } from '@renderer/utils/music'

const createDelayNextTimeout = (delay: number) => {
  let timeout: number | null
  const clearDelayNextTimeout = () => {
    // console.log(this.timeout)
    if (timeout) {
      BackgroundTimer.clearTimeout(timeout)
      timeout = null
    }
  }

  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    timeout = BackgroundTimer.setTimeout(() => {
      timeout = null
      if (global.lx.isPlayedStop) return
      void playNext(true)
    }, delay)
  }

  return {
    clearDelayNextTimeout,
    addDelayNextTimeout,
  }
}
const { addDelayNextTimeout, clearDelayNextTimeout } = createDelayNextTimeout(5000)
const { addDelayNextTimeout: addLoadTimeout, clearDelayNextTimeout: clearLoadTimeout } = createDelayNextTimeout(100000)

const createGettingUrlId = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const tInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.meta.toggleMusicInfo : musicInfo.meta.toggleMusicInfo
  return `${musicInfo.id}_${tInfo?.id ?? ''}`
}
/**
 * 检查音乐信息是否已更改
 */
const diffCurrentMusicInfo = (curMusicInfo: LX.Music.MusicInfo | LX.Download.ListItem): boolean => {
  // return curMusicInfo !== playerState.playMusicInfo.musicInfo || playerState.isPlay
  return createGettingUrlId(curMusicInfo) != global.lx.gettingUrlId || curMusicInfo.id != playerState.playMusicInfo.musicInfo?.id || playerState.isPlay
}

let cancelDelayRetry: (() => void) | null = null
/**
 * 限流重试的退避档位（秒）。
 *
 * 原来是 `getRandom(2, 6)` —— 每次都要盲等 2~6 秒，用户体感就是「点了没反应」，
 * 而且失败后没有次数上限，会一直等下去。
 * 现在改成 1 → 2 → 4 的递增退避，最多 3 次（累计 7 秒），
 * 首次只等 1 秒，限流不严重时基本察觉不到。
 */
const RETRY_DELAYS = [1, 2, 4]

const delayRetry = async(
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh = false,
  attempt = 0,
): Promise<string | null> => {
  // if (cancelDelayRetry) cancelDelayRetry()
  return new Promise<string | null>((resolve, reject) => {
    const time = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
    setStatusText(global.i18n.t('player__getting_url_delay_retry', { time }))
    const timeout = setTimeout(() => {
      getMusicPlayUrl(musicInfo, isRefresh, true, attempt + 1).then((result) => {
        cancelDelayRetry = null
        resolve(result)
      }).catch(async(err: any) => {
        cancelDelayRetry = null
        reject(err)
      })
    }, time * 1000)
    cancelDelayRetry = () => {
      clearTimeout(timeout)
      cancelDelayRetry = null
      resolve(null)
    }
  })
}
/**
 * 把「实际解析出的音源 / 音质」回写到播放状态。
 *
 * 多音源换源之后如果只拿到 url 不更新 state，界面会一直显示请求时的音源和音质
 * （例如显示「无损 FLAC」，实际播的是备选音源的 320k）；而且下次播放还会先走一遍
 * 已经失效的原音源、白等一次超时。所以这里做两件事：
 *   1. 把实际音质写进 playerState.playQuality（进度条/播放页显示真实音质）；
 *   2. 把换到的 musicInfo 记进 toggleMusicInfo（下次播放直接走可用音源）。
 */
const applyResolvedMusicUrl = (
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  result: ResolvedMusicUrl,
) => {
  // 本地文件没有音质概念，不要覆盖 ''（否则会显示成上次播放的音质）
  if (result.quality) playerState.playQuality = result.quality

  // 下载任务播放时，歌曲信息挂在 metadata.musicInfo 上
  const rootMusicInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  if (rootMusicInfo.source === 'local' || result.musicInfo.source === 'local') return

  // 没换源（还是原来那首歌）：只是音质降级，不需要记 toggleMusicInfo
  if (result.musicInfo.id === rootMusicInfo.id && result.musicInfo.source === rootMusicInfo.source) return

  const recorded = rootMusicInfo.meta.toggleMusicInfo
  if (recorded && recorded.id === result.musicInfo.id && recorded.source === result.musicInfo.source) {
    // 已经记过同一个换源结果（这次就是用它播的），不要每次播放都弹提示
    return
  }

  rootMusicInfo.meta.toggleMusicInfo = result.musicInfo
  log.info(`toggle source success: ${rootMusicInfo.source} -> ${result.musicInfo.source}`)
  // 只在真正换了音源时提示一次，让用户知道为什么音质/时长可能和原来不一样
  toast(`${global.i18n.t('toggle_source')}: ${getSourceName(result.musicInfo.source)}`)
  // 换源后歌词/时长可能来自不同版本：重新拉取实际播放源的歌词
  const resumeId = rootMusicInfo.id
  void getLyricInfo({ musicInfo: result.musicInfo }).then(lyricInfo => {
    if (playerState.playMusicInfo.musicInfo?.id !== resumeId) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    global.app_event.lyricUpdated()
  }).catch(() => {})
}

const getMusicPlayUrl = async(
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh = false,
  isRetryed = false,
  retryAttempt = 0,
  forceToggleSource = false,
): Promise<string | null> => {
  // this.musicInfo.url = await getMusicPlayUrl(targetSong, type)
  setStatusText(global.i18n.t('player__getting_url'))
  addLoadTimeout()

  // 记录本次实际会用的音质，供播放器界面展示真实信息
  if ('progress' in musicInfo) {
    playerState.playQuality = musicInfo.metadata.quality
  } else if (musicInfo.source === 'local') {
    playerState.playQuality = ''
  } else {
    playerState.playQuality = getPlayQuality(
      settingState.setting['player.playQuality'],
      musicInfo,
    )
  }

  // 本地优先播放：如果是在线歌曲，先检查本地是否已有相同歌曲的文件
  if (!('progress' in musicInfo) && musicInfo.source !== 'local' && !isRefresh) {
    try {
      const { getLocalMusicList } = await import('@/core/localMusic')
      const localList = await getLocalMusicList()
      const localMatch = localList.find(item =>
        item.name === musicInfo.name && item.singer === musicInfo.singer,
      )
      if (localMatch?.meta.filePath) {
        const RNFS = await import('react-native-fs')
        const exists = await RNFS.exists(localMatch.meta.filePath)
        if (exists) {
          return localMatch.meta.filePath
        }
      }
    } catch {}
  }

  // const type = getPlayType(settingState.setting['player.isPlayHighQuality'], musicInfo)
  let toggleMusicInfo = ('progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo).meta.toggleMusicInfo

  return (toggleMusicInfo ? resolveMusicUrl({
    musicInfo: toggleMusicInfo,
    isRefresh,
    allowToggleSource: false,
  }) : Promise.reject(new Error('not found'))).catch(async() => {
    return resolveMusicUrl({
      musicInfo,
      isRefresh,
      forceToggleSource,
      onToggleSource(mInfo) {
        if (diffCurrentMusicInfo(musicInfo)) return
        setStatusText(global.i18n.t('toggle_source_try'))
      },
    })
  }).then(result => {
    if (global.lx.isPlayedStop || diffCurrentMusicInfo(musicInfo)) return null

    // 拿到地址后把实际音源 / 音质回写，界面和后续播放都以此为准
    applyResolvedMusicUrl(musicInfo, result)
    return result.url
  }).catch(async err => {
    // console.log('err', err.message)
    if (global.lx.isPlayedStop ||
      diffCurrentMusicInfo(musicInfo) ||
      err.message == requestMsg.cancelRequest) return null

    if (err.message == requestMsg.tooManyRequests) {
      // 退避次数用尽就认输，别无限等下去
      if (retryAttempt >= RETRY_DELAYS.length) throw err
      return delayRetry(musicInfo, isRefresh, retryAttempt)
    }

    if (!isRetryed) return getMusicPlayUrl(musicInfo, isRefresh, true, retryAttempt, forceToggleSource)

    throw err
  })
}

/* ───────────── 播放失败自动刷新地址 / 换源 ───────────── */

/** 同一首歌连续 PlaybackError 的次数：第一次刷新地址，第二次强制换源，之后认输 */
let playbackErrorKey = ''
let playbackErrorCount = 0

const getPlaybackErrorKey = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const root = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  return `${root.source}_${root.id}`
}

/** 播放成功 / 切歌时复位重试计数 */
export const resetPlaybackErrorRetry = () => {
  playbackErrorKey = ''
  playbackErrorCount = 0
}

/**
 * 播放器报告 PlaybackError 时调用（CDN 404/403、链接过期、源站返回错误页等）：
 *  - 第 1 次：刷新播放地址后重试；
 *  - 第 2 次：强制换到其它音源重试；
 *  - 第 3 次起返回 false，交给界面报错 / 自动下一首。
 *
 * 为什么不直接在播放器里报错：URL 过期和「源站 404」是多音源场景最常见的失败，
 * 用户点播放却看到一条错误、得自己再点一次，体验很差；这里静默重试两次，
 * 成功就把换到的音源回写 toggleMusicInfo，下次播放不会再撞同一个坏地址。
 *
 * @returns 是否已经接管并开始重试
 */
export const handlePlaybackErrorRetry = (): boolean => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo || global.lx.isPlayedStop) return false
  const root = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  if (root.source === 'local') return false
  const key = getPlaybackErrorKey(musicInfo)
  if (playbackErrorKey !== key) {
    playbackErrorKey = key
    playbackErrorCount = 0
  }
  if (playbackErrorCount >= 2) {
    resetPlaybackErrorRetry()
    return false
  }
  const forceToggle = playbackErrorCount >= 1
  playbackErrorCount += 1
  global.lx.gettingUrlId = createGettingUrlId(musicInfo)
  setStatusText(global.i18n.t(forceToggle ? 'toggle_source_try' : 'player__getting_url'))
  log.info(`[player] playback error retry (refresh=${String(!forceToggle)}, toggleSource=${String(forceToggle)})`)
  void getMusicPlayUrl(musicInfo, true, true, 0, forceToggle).then((url) => {
    if (!url) return
    setResource(musicInfo, url, getStartTime(musicInfo))
  }).catch((err: any) => {
    log.error(err)
    setStatusText(err.message as string)
    global.app_event.error()
    global.app_event.playerError()
    addDelayNextTimeout()
  }).finally(() => {
    if (musicInfo === playerState.playMusicInfo.musicInfo) clearLoadTimeout()
  })
  return true
}

const getStartTime = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem): number => {
  if ('meta' in musicInfo && musicInfo.meta && 'filePath' in musicInfo.meta) {
    return getCueStartSeconds(musicInfo.meta, playerState.progress.nowPlayTime)
  }
  return playerState.progress.nowPlayTime
}

export const setMusicUrl = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh?: boolean) => {
  // addLoadTimeout()
  if (!diffCurrentMusicInfo(musicInfo)) return
  if (cancelDelayRetry) cancelDelayRetry()
  global.lx.gettingUrlId = createGettingUrlId(musicInfo)
  void getMusicPlayUrl(musicInfo, isRefresh).then((url) => {
    if (!url) return
    resetPlaybackErrorRetry()
    setResource(musicInfo, url, getStartTime(musicInfo))
  }).catch((err: any) => {
    log.error(err)
    setStatusText(err.message as string)
    global.app_event.error()
    global.lx.restorePlayInfo = null
    addDelayNextTimeout()
  }).finally(() => {
    if (musicInfo === playerState.playMusicInfo.musicInfo) {
      global.lx.gettingUrlId = ''
      clearLoadTimeout()
    }
  })
}

// 恢复上次播放的状态
const handleRestorePlay = async(restorePlayInfo: LX.Player.SavedPlayInfo) => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return

  setTimeout(() => {
    global.app_event.setProgress(settingState.setting['player.isSavePlayTime'] ? restorePlayInfo.time : 0, restorePlayInfo.maxTime)
  })

  const playMusicInfo = playerState.playMusicInfo

  void initTrackInfo(musicInfo, playerState.musicInfo)
  // 恢复播放也算一次「最近播放」，否则杀进程回来首页会少一首
  void addRecentPlay(musicInfo)

  void getPicPath({ musicInfo, listId: playMusicInfo.listId }).then((url: string) => {
    if (
      musicInfo.id != playMusicInfo.musicInfo?.id ||
      playerState.musicInfo.pic == url ||
      playerState.loadErrorPicUrl == url
    ) return
    setMusicInfo({ pic: url })
    global.app_event.picUpdated()
    // 封面失败不该影响播放，也不该变成未处理的 Promise 拒绝
  }).catch((err: unknown) => { log.error(err) })

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    global.app_event.lyricUpdated()
  }).catch((err) => {
    log.error(err)
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setStatusText(global.i18n.t('lyric__load_error'))
  })

  if (settingState.setting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList(playMusicInfo as LX.Player.PlayMusicInfo)
}


/*
  切歌淡入淡出（W4 / D-14）。
  - 播放换歌前把音量渐降到 0，再 setStop / 加载新歌；
  - 新歌起播后约 300ms 渐升回用户设置音量；
  - 暂停时强制取消渐隐并把音量恢复，避免“暂停后声音变小”。
*/
let fadeGeneration = 0
/** 后台/锁屏时不跑淡入淡出：JS 定时器会被挂起，音量可能停在 0 */
const isAppForeground = () => AppState.currentState === 'active'


let fadeTimer: ReturnType<typeof setTimeout> | null = null
let currentFadeVolume = 1

const sleep = async(ms: number) => { await new Promise<void>(resolve => { setTimeout(resolve, ms) }) }

const cancelFade = () => {
  fadeGeneration += 1
  if (fadeTimer) {
    clearTimeout(fadeTimer)
    fadeTimer = null
  }
}

const fadeVolumeTo = async(target: number, durationMs: number) => {
  const generation = ++fadeGeneration
  const from = currentFadeVolume
  const steps = Math.max(2, Math.min(16, Math.round(durationMs / 80)))
  for (let i = 1; i <= steps; i++) {
    if (generation !== fadeGeneration) return
    const next = from + (target - from) * (i / steps)
    currentFadeVolume = next
    await setVolume(next).catch(() => {})
    if (i < steps) await sleep(durationMs / steps)
  }
  currentFadeVolume = target
}

const restoreVolume = () => {
  cancelFade()
  const volume = settingState.setting['player.volume']
  currentFadeVolume = volume
  void setVolume(volume).catch(() => {})
}

AppState.addEventListener('change', state => {
  // 回到前台兜底：若上一次切歌把音量压到 0，恢复用户音量
  if (state === 'active' && playerState.isPlay && currentFadeVolume <= 0.01) restoreVolume()
})

const debouncePlay = debounceBackgroundTimer((musicInfo: LX.Player.PlayMusic) => {
  setMusicUrl(musicInfo)

  void getPicPath({ musicInfo, listId: playerState.playMusicInfo.listId }).then((url: string) => {
    if (
      musicInfo.id != playerState.playMusicInfo.musicInfo?.id ||
      playerState.musicInfo.pic == url ||
      playerState.loadErrorPicUrl == url) return
    setMusicInfo({ pic: url })
    global.app_event.picUpdated()
  }).catch((err: unknown) => { log.error(err) })

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if (musicInfo.id != playerState.playMusicInfo.musicInfo?.id) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    global.app_event.lyricUpdated()
  }).catch((err) => {
    log.error(err)
    if (musicInfo.id != playerState.playMusicInfo.musicInfo?.id) return
    setStatusText(global.i18n.t('lyric__load_error'))
  })
}, 200)

// 处理音乐播放
const handlePlay = async(isRestore = false) => {
  if (!isInitialized()) {
    await checkNotificationPermission()
    void checkIgnoringBatteryOptimization()
    await playerInitial({
      volume: settingState.setting['player.volume'],
      playRate: settingState.setting['player.playbackRate'],
      cacheSize: settingState.setting['player.cacheSize'] ? parseInt(settingState.setting['player.cacheSize']) : 0,
      isHandleAudioFocus: settingState.setting['player.isHandleAudioFocus'],
      isEnableAudioOffload: settingState.setting['player.isEnableAudioOffload'],
    })
  }

  global.lx.isPlayedStop &&= false
  resetRandomNextMusicInfo()

  if (isRestore && global.lx.restorePlayInfo) {
    /*
      只有启动恢复（init/player/playInfo 传入 isRestore=true）才走恢复分支。
      手动点歌时即使 restorePlayInfo 还有残留，也必须清掉并继续正常播放，
      否则首次播放会被劫持回上次进度、甚至触发自动切歌。
    */
    void handleRestorePlay(global.lx.restorePlayInfo)
    return
  }
  // 手动播放：任何残留的恢复标记都作废，避免插件把这次播放当恢复而 pause
  if (!isRestore) global.lx.restorePlayInfo = null

  const playMusicInfo = playerState.playMusicInfo
  const musicInfo = playMusicInfo.musicInfo

  if (!musicInfo) return

  const fadeSeconds = settingState.setting['player.fadeSeconds'] ?? 0
  const fadeMs = fadeSeconds > 0 ? Math.min(6000, fadeSeconds * 1000 / 2) : 0
  if (fadeMs > 0 && isInitialized() && playerState.isPlay && isAppForeground()) {
    await fadeVolumeTo(0, fadeMs)
  } else {
    currentFadeVolume = settingState.setting['player.volume']
  }

  await setStop()
  global.app_event.pause()

  clearDelayNextTimeout()
  clearLoadTimeout()

  // 首页「最近播放」和随机模式无关：任何模式播过的歌都记一笔
  void addRecentPlay(musicInfo)

  if (settingState.setting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList(playMusicInfo as LX.Player.PlayMusicInfo)

  debouncePlay(musicInfo)
  if (fadeMs > 0 && isAppForeground()) {
    // 新歌加载/起播有延迟，稍等再渐入；播放失败时由下面的 restoreVolume 兜底
    currentFadeVolume = 0
    void setVolume(0).catch(() => {})
    fadeTimer = setTimeout(() => {
      fadeTimer = null
      if (!isAppForeground()) { restoreVolume(); return }
      void fadeVolumeTo(settingState.setting['player.volume'], fadeMs)
    }, 350)
  } else {
    // 后台/锁屏直接恢复用户音量，避免自动切歌后 0 音量
    restoreVolume()
  }
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param id 歌曲id
 */
export const playListById = async(listId: string, id: string) => {
  const prevListId = playerState.playInfo.playerListId
  setPlayListId(listId)
  const musicInfo = getList(listId).find(m => m.id == id)
  if (!musicInfo) return
  setPlayMusicInfo(listId, musicInfo)
  if (settingState.setting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  await handlePlay()
}

/**
 * 直接播放指定的完整歌曲对象（不做 listId/index 反查）。
 * 歌单排序/过滤后显示 index 与原始列表不一致，用这个最稳。
 */
export const playMusicInfo = async(listId: string, musicInfo: LX.Music.MusicInfo, isRestore = false) => {
  // 歌单里的历史条目可能缺 source/meta：按本地文件路径/id 找回完整条目再播
  let info: LX.Music.MusicInfo = normalizeMusicInfo(musicInfo)
  if (!info.source || !info.meta) {
    const local = getLocalMusicListSync()
    const legacyPath = info.id?.startsWith('local_') ? info.id.slice(6) : ''
    const full = local?.find(item => item.id === info.id || (legacyPath && item.meta?.filePath === legacyPath))
    if (full) info = full
  }
  const prevListId = playerState.playInfo.playerListId
  setPlayListId(listId)
  setPlayMusicInfo(listId, info)
  if (settingState.setting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  await handlePlay(isRestore)
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param index 播放的歌曲位置
 */
export const playList = async(listId: string, index: number, isRestore = false) => {
  const prevListId = playerState.playInfo.playerListId
  setPlayListId(listId)
  setPlayMusicInfo(listId, getList(listId)[index])
  if (settingState.setting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  await handlePlay(isRestore)
}

const handleToggleStop = async() => {
  await stop()
  setTimeout(() => {
    setPlayMusicInfo(null, null)
  })
}


const randomNextMusicInfo = {
  info: null as LX.Player.PlayMusicInfo | null,
  // index: -1,
}
export const resetRandomNextMusicInfo = () => {
  if (randomNextMusicInfo.info) {
    randomNextMusicInfo.info = null
    // randomNextMusicInfo.index = -1
  }
}

export const getNextPlayMusicInfo = async(): Promise<LX.Player.PlayMusicInfo | null> => {
  if (playerState.tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    const playMusicInfo = playerState.tempPlayList[0]
    return playMusicInfo
  }

  if (playerState.playMusicInfo.musicInfo == null) return null

  if (randomNextMusicInfo.info) return randomNextMusicInfo.info

  const playMusicInfo = playerState.playMusicInfo
  const playInfo = playerState.playInfo
  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return null
  const currentList = getList(currentListId)

  const playedList = playerState.playedList
  if (playedList.length) { // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo!.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) + 1; index < playedList.length; index++) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) return playedList[index]
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) return null
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = settingState.setting['player.togglePlayMethod']
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      return null
  }
  if (nextIndex < 0) return null

  const nextPlayMusicInfo = {
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }

  if (togglePlayMethod == 'random') {
    randomNextMusicInfo.info = nextPlayMusicInfo
    // randomNextMusicInfo.index = nextIndex
  }
  return nextPlayMusicInfo
}

const handlePlayNext = async(playMusicInfo: LX.Player.PlayMusicInfo) => {
  setPlayMusicInfo(playMusicInfo.listId, playMusicInfo.musicInfo, playMusicInfo.isTempPlay)
  await handlePlay()
}
/**
 * 下一曲
 * @param isAutoToggle 是否自动切换
 * @returns
 */
export const playNext = async(isAutoToggle = false): Promise<void> => {
  if (playerState.tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    const playMusicInfo = playerState.tempPlayList[0]
    removeTempPlayList(0)
    await handlePlayNext(playMusicInfo)
    return
  }

  const playMusicInfo = playerState.playMusicInfo
  const playInfo = playerState.playInfo
  if (playMusicInfo.musicInfo == null) return handleToggleStop()

  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return handleToggleStop()
  const currentList = getList(currentListId)

  const playedList = playerState.playedList

  if (playedList.length) { // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) + 1; index < playedList.length; index++) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) {
      await handlePlayNext(playedList[index])
      return
    }
  }
  if (randomNextMusicInfo.info) {
    await handlePlayNext(randomNextMusicInfo.info)
    return
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) return handleToggleStop()
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = settingState.setting['player.togglePlayMethod']
  if (!isAutoToggle) {
    switch (togglePlayMethod) {
      case 'list':
      case 'singleLoop':
      case 'none':
        togglePlayMethod = 'listLoop'
    }
  }
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      nextIndex = -1
      return
  }
  if (nextIndex < 0) return

  await handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * 上一曲
 */
export const playPrev = async(isAutoToggle = false): Promise<void> => {
  const playMusicInfo = playerState.playMusicInfo
  if (playMusicInfo.musicInfo == null) return handleToggleStop()
  const playInfo = playerState.playInfo

  const currentListId = playInfo.playerListId
  if (!currentListId) return handleToggleStop()
  const currentList = getList(currentListId)

  const playedList = playerState.playedList
  if (playedList.length) {
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) - 1; index > -1; index--) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index > -1) {
      await handlePlayNext(playedList[index])
      return
    }
  }

  // const isCheckFile = findNum > 2
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: false,
  })
  if (!filteredList.length) return handleToggleStop()

  // let currentIndex = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex
  if (!playMusicInfo.isTempPlay) {
    let togglePlayMethod = settingState.setting['player.togglePlayMethod']
    if (!isAutoToggle) {
      switch (togglePlayMethod) {
        case 'list':
        case 'singleLoop':
        case 'none':
          togglePlayMethod = 'listLoop'
      }
    }
    switch (togglePlayMethod) {
      case 'random':
        nextIndex = getRandom(0, filteredList.length)
        break
      case 'listLoop':
      case 'list':
        nextIndex = playerIndex === 0 ? filteredList.length - 1 : playerIndex - 1
        break
      case 'singleLoop':
        break
      default:
        nextIndex = -1
        return
    }
    if (nextIndex < 0) return
  }


  await handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * 恢复播放
 */
export const play = () => {
  if (playerState.playMusicInfo.musicInfo == null) return
  if (isEmpty()) {
    if (createGettingUrlId(playerState.playMusicInfo.musicInfo) != global.lx.gettingUrlId) setMusicUrl(playerState.playMusicInfo.musicInfo)
    return
  }
  void setPlay()
}

/**
 * 暂停播放
 */
export const pause = async() => {
  await setPause()
}

/**
 * 停止播放
 */
export const stop = async() => {
  await setStop()
  setTimeout(() => {
    global.app_event.stop()
  })
}

/**
 * 播放、暂停播放切换
 */
export const togglePlay = () => {
  global.lx.isPlayedStop &&= false
  if (playerState.isPlay) {
    restoreVolume()
    void pause()
  } else {
    restoreVolume()
    play()
  }
}

/**
 * 收藏当前播放的歌曲
 */
export const collectMusic = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  void addListMusics(LIST_IDS.LOVE, [
    'progress' in playerState.playMusicInfo.musicInfo
      ? playerState.playMusicInfo.musicInfo.metadata.musicInfo
      : playerState.playMusicInfo.musicInfo,
  ], settingState.setting['list.addMusicLocationType'])
}

/**
 * 取消收藏当前播放的歌曲
 */
export const uncollectMusic = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  void removeListMusics(LIST_IDS.LOVE, [
    'progress' in playerState.playMusicInfo.musicInfo
      ? playerState.playMusicInfo.musicInfo.metadata.musicInfo.id
      : playerState.playMusicInfo.musicInfo.id,
  ])
}

/**
 * 不喜欢当前播放的歌曲
 */
export const dislikeMusic = async() => {
  if (!playerState.playMusicInfo.musicInfo) return
  const minfo = 'progress' in playerState.playMusicInfo.musicInfo ? playerState.playMusicInfo.musicInfo.metadata.musicInfo : playerState.playMusicInfo.musicInfo
  await addDislikeInfo([{ name: minfo.name, singer: minfo.singer }])
  await playNext(true)
}

