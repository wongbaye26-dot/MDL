import {
  play as lrcPlay,
  setLyric as lrcSetLyric,
  pause as lrcPause,
  setPlaybackRate as lrcSetPlaybackRate,
  toggleTranslation as lrcToggleTranslation,
  toggleRoma as lrcToggleRoma,
  init as lrcInit,
} from '@/plugins/lyric'
import {
  playDesktopLyric,
  setDesktopLyric,
  pauseDesktopLyric,
  setDesktopLyricPlaybackRate,
  toggleDesktopLyricTranslation,
  toggleDesktopLyricRoma,
} from '@/core/desktopLyric'
import { getOtherSource, handleGetOnlineLyricInfo } from '@/core/music/utils'
import { getPosition } from '@/plugins/player'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { updateNowPlayingTitles } from '@/plugins/player/utils'
import { log } from '@/utils/log'

/**
 * init lyric
 */
export const init = async() => {
  return lrcInit()
}

/**
 * set lyric
 * @param lyric lyric str
 * @param translation lyric translation
 */
const handleSetLyric = async(lyric: string, translation = '', romalrc = '') => {
  lrcSetLyric(lyric, translation, romalrc)
  await setDesktopLyric(lyric, translation, romalrc)
  if (settingState.setting['player.isShowBluetoothFullLyric']) {
    void updateNowPlayingTitles({
      lyric,
    })
  }
}

const TIME_TAG_RXP = /\[[^\]]*\]/g
const CJK_RXP = /[\u3400-\u4dbf\u4e00-\u9fff]/g
const FOREIGN_RXP = /[A-Za-z\u00c0-\u024f\u0e00-\u0e7f\u0400-\u04ff\u3040-\u30ff\uac00-\ud7af]/g

/** 去掉时间标签后判断是不是以外文（英文/泰文/其它字母语言）为主的歌词 */
const isForeignLyric = (lyric: string) => {
  const text = lyric.replace(TIME_TAG_RXP, '')
  const cjk = text.match(CJK_RXP)?.length ?? 0
  const foreign = text.match(FOREIGN_RXP)?.length ?? 0
  if (foreign < 8) return false
  return cjk / (cjk + foreign) < 0.2
}

const normalizeLyricLine = (line: string) => line
  .replace(TIME_TAG_RXP, '')
  .replace(/[^\w\u4e00-\u9fff\u0e00-\u0e7f\u0400-\u04ff\u3040-\u30ff\uac00-\ud7af]/g, '')
  .toLowerCase()

/**
 * 粗略判断两份歌词是不是同一首歌（按整行文本重合度）。
 * 补翻译时其它音源可能搜到同名的现场版/翻唱版，挂上去就是错翻，宁可不补。
 */
const isSimilarLyric = (a: string, b: string) => {
  const toSet = (lyric: string) => new Set(
    lyric.split(/\r\n|\n|\r/)
      .map(normalizeLyricLine)
      .filter(text => text.length > 0),
  )
  const aSet = toSet(a)
  const bSet = toSet(b)
  if (!aSet.size || !bSet.size) return false
  let same = 0
  for (const line of bSet) {
    if (aSet.has(line)) same++
  }
  return same / Math.min(aSet.size, bSet.size) >= 0.35
}

/** 已经为哪首歌尝试过补翻译，避免每次歌词更新都重复请求 */
const translationTried = new Set<string>()
/** 从其它音源补到的翻译（当前音源之后重新 setLyric 时还要能挂回来） */
const supplementedTranslations = new Map<string, string>()

/**
 * 当前音源没有中文翻译（tlyric）时，去其它音源补一次翻译：
 * 只在「外文歌词 + 用户打开了歌词翻译 + 当前确实没有翻译」时触发；
 * 失败静默、不阻塞歌词显示，也不改主歌词（只把别的源的翻译按时间对齐挂到当前歌词上）。
 */
export const trySupplementTranslation = async() => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return
  if (playerState.musicInfo.id !== musicInfo.id) return
  if (playerState.musicInfo.tlrc) return
  const lrc = playerState.musicInfo.lrc
  if (!lrc || !isForeignLyric(lrc)) return
  if (translationTried.has(musicInfo.id)) return
  translationTried.add(musicInfo.id)

  const id = musicInfo.id
  try {
    // 按歌名/歌手/时长找其它音源里的同一首歌（在线/下载/本地音乐都支持；内部 12s 超时，失败会 reject）
    const otherSources = await getOtherSource(musicInfo, true)
    for (const candidate of otherSources.slice(0, 4)) {
      if (playerState.musicInfo.id !== id) return
      if (playerState.musicInfo.tlrc) return
      try {
        const { lyricInfo } = await handleGetOnlineLyricInfo({
          musicInfo: candidate,
          onToggleSource: () => {},
          isRefresh: true,
          allowToggleSource: false,
        })
        const tlyric = lyricInfo.tlyric
        if (!tlyric || !isSimilarLyric(lrc, lyricInfo.lyric)) continue
        if (playerState.musicInfo.id !== id) return
        if (supplementedTranslations.size > 20) supplementedTranslations.clear()
        supplementedTranslations.set(id, tlyric)
        // 用当前主歌词 + 补到的翻译重新喂给 parser（时间轴由 plugins/lyric 负责对齐）
        await handleSetLyric(lrc, tlyric, playerState.musicInfo.rlrc ?? '')
        if (playerState.isPlay) play()
        return
      } catch (err) {
        // 单个音源失败不影响其它音源，也不影响歌词显示
        log.warn('supplement lyric translation failed', err)
      }
    }
  } catch (err) {
    log.warn('find other source for lyric translation failed', err)
  }
}

/**
 * play lyric
 * @param time play time
 */
export const handlePlay = (time: number) => {
  lrcPlay(time)
  void playDesktopLyric(time)
}

/**
 * pause lyric
 */
export const pause = () => {
  lrcPause()
  void pauseDesktopLyric()
}

/**
 * stop lyric
 */
export const stop = () => {
  void handleSetLyric('')
}

/**
 * set playback rate
 * @param playbackRate playback rate
 */
export const setPlaybackRate = async(playbackRate: number) => {
  lrcSetPlaybackRate(playbackRate)
  await setDesktopLyricPlaybackRate(playbackRate)
  if (playerState.isPlay) {
    setTimeout(() => {
      void getPosition().then((position) => {
        handlePlay(position * 1000)
      })
    })
  }
}

/**
 * toggle show translation
 * @param isShowTranslation is show translation
 */
export const toggleTranslation = async(isShowTranslation: boolean) => {
  lrcToggleTranslation(isShowTranslation)
  await toggleDesktopLyricTranslation(isShowTranslation)
  // 打开翻译时当前音源没有中文翻译 → 后台补一次（失败静默，不阻塞）
  if (isShowTranslation) void trySupplementTranslation()
  if (playerState.isPlay) play()
}

/**
 * toggle show roma lyric
 * @param isShowLyricRoma is show roma lyric
 */
export const toggleRoma = async(isShowLyricRoma: boolean) => {
  lrcToggleRoma(isShowLyricRoma)
  await toggleDesktopLyricRoma(isShowLyricRoma)
  if (playerState.isPlay) play()
}

export const play = () => {
  void getPosition().then((position) => {
    handlePlay(position * 1000)
  })
}


export const setLyric = async() => {
  if (!playerState.musicInfo.id) return
  if (playerState.musicInfo.lrc) {
    let tlrc = ''
    let rlrc = ''
    if (playerState.musicInfo.tlrc) tlrc = playerState.musicInfo.tlrc
    else if (playerState.musicInfo.id) tlrc = supplementedTranslations.get(playerState.musicInfo.id) ?? ''
    if (playerState.musicInfo.rlrc) rlrc = playerState.musicInfo.rlrc
    await handleSetLyric(playerState.musicInfo.lrc, tlrc, rlrc)
    // 外文歌词当前音源没带中文翻译：如果用户开着翻译，去其它音源补一次
    if (!tlrc && settingState.setting['player.isShowLyricTranslation']) void trySupplementTranslation()
  }

  if (playerState.isPlay) play()
}
