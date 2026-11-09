import {
  saveLyric,
  saveMusicUrl,
  getMusicUrl as getStoreMusicUrl,
} from '@/utils/data'
import { updateListMusics } from '@/core/list'
import settingState from '@/store/setting/state'

import {
  buildLyricInfo,
  getPlayQuality,
  handleGetOnlineLyricInfo,
  handleGetOnlineMusicUrl,
  handleGetOnlinePicUrl,
  getCachedLyricInfo,
} from './utils'

/* export const setMusicUrl = ({ musicInfo, type, url }: {
  musicInfo: LX.Music.MusicInfo
  type: LX.Quality
  url: string
}) => {
  saveMusicUrl(musicInfo, type, url)
}

export const setPic = (datas: {
  listId: string
  musicInfo: LX.Music.MusicInfo
  url: string
}) => {
  datas.musicInfo.img = datas.url
  updateMusicInfo({
    listId: datas.listId,
    id: datas.musicInfo.songmid,
    data: { img: datas.url },
    musicInfo: datas.musicInfo,
  })
}
 */


/** 解析在线歌曲播放地址的结果：带上「实际」音源与音质（换源/降级后与请求值可能不同） */
export interface OnlineMusicUrlDetail {
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}

/**
 * 解析在线歌曲的播放地址。
 *
 * 和只返回 url 的 getMusicUrl 相比，这里额外返回**实际**命中的音源与音质：
 * 多音源自动换源之后，播放器要把换到的 musicInfo 记进 toggleMusicInfo、
 * 把实际音质记进 playerState.playQuality，界面/状态栏才不会显示成「请求的音质」。
 */
/** 同一首歌/音质的并发解析合并（播放、预加载、下载同时请求时只打一次网络） */
const inflightUrlRequests = new Map<string, Promise<OnlineMusicUrlDetail>>()
/** 播放地址缓存命中统计，供后续诊断/优化使用 */
let urlCacheHits = 0
let urlCacheMisses = 0
export const getUrlCacheMetrics = () => ({
  hits: urlCacheHits,
  misses: urlCacheMisses,
  rate: urlCacheHits + urlCacheMisses ? urlCacheHits / (urlCacheHits + urlCacheMisses) : 0,
})

export const resolveMusicUrl = async({ musicInfo, quality, isRefresh, allowToggleSource = true, onToggleSource = () => {}, forceToggleSource = false }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  /** 跳过当前音源直接换源（下载内容与音质不符时用） */
  forceToggleSource?: boolean
}): Promise<OnlineMusicUrlDetail> => {
  const targetQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)
  // 强制换源时不能再走原音源的 URL 缓存，否则会拿回同一个错误音源
  if (!forceToggleSource) {
    const cachedUrl = await getStoreMusicUrl(musicInfo, targetQuality)
    if (cachedUrl && !isRefresh) {
      urlCacheHits++
      return { url: cachedUrl, musicInfo, quality: targetQuality, isFromCache: true }
    }
  }
  urlCacheMisses++

  const key = `${musicInfo.id}|${targetQuality}|${forceToggleSource ? 1 : 0}|${isRefresh ? 1 : 0}`
  const existing = inflightUrlRequests.get(key)
  if (existing) return existing
  const task = handleGetOnlineMusicUrl({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource, forceToggleSource }).then(({ url, quality: actualQuality, musicInfo: targetMusicInfo, isFromCache }) => {
    // 缓存按「实际音源 + 实际音质」记：换源后如果还按原音源记，下次播放又会先走一遍失败
    if (targetMusicInfo.id !== musicInfo.id && !isFromCache) void saveMusicUrl(targetMusicInfo, actualQuality, url)
    void saveMusicUrl(musicInfo, actualQuality, url)
    return { url, musicInfo: targetMusicInfo, quality: actualQuality, isFromCache }
  }).finally(() => {
    if (inflightUrlRequests.get(key) === task) inflightUrlRequests.delete(key)
  })
  inflightUrlRequests.set(key, task)
  return task
}

export const getMusicUrl = async({ musicInfo, quality, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  // if (!musicInfo._types[type]) {
  //   // 兼容旧版酷我源搜索列表过滤128k音质的bug
  //   if (!(musicInfo.source == 'kw' && type == '128k')) throw new Error('该歌曲没有可播放的音频')

  //   // return Promise.reject(new Error('该歌曲没有可播放的音频'))
  // }
  return (await resolveMusicUrl({ musicInfo, quality, isRefresh, allowToggleSource, onToggleSource })).url
}

export const getPicUrl = async({ musicInfo, listId, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  listId?: string | null
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if (musicInfo.meta.picUrl && !isRefresh) return musicInfo.meta.picUrl
  return handleGetOnlinePicUrl({ musicInfo, onToggleSource, isRefresh, allowToggleSource }).then(({ url, musicInfo: targetMusicInfo, isFromCache }) => {
    // picRequest = null
    if (listId) {
      musicInfo.meta.picUrl = url
      void updateListMusics([{ id: listId, musicInfo }])
    }
    // savePic({ musicInfo, url, listId })
    return url
  })
}
export const getLyricInfo = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return buildLyricInfo(lyricInfo)
  }

  // lrcRequest = music[musicInfo.source].getLyric(musicInfo)
  return handleGetOnlineLyricInfo({ musicInfo, onToggleSource, isRefresh, allowToggleSource }).then(async({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
    // lrcRequest = null
    if (isFromCache) return buildLyricInfo(lyricInfo)
    if (targetMusicInfo.id == musicInfo.id) void saveLyric(musicInfo, lyricInfo)
    else void saveLyric(targetMusicInfo, lyricInfo)

    return buildLyricInfo(lyricInfo)
  })
}
