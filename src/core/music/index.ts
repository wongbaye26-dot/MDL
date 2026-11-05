// if (targetSong.key) { // 如果是已下载的歌曲
//   const filePath = path.join(appSetting['download.savePath'], targetSong.metadata.fileName)
//   // console.log(filePath)

import {
  getMusicUrl as getOnlineMusicUrl,
  getPicUrl as getOnlinePicUrl,
  getLyricInfo as getOnlineLyricInfo,
  resolveMusicUrl as resolveOnlineMusicUrl,
} from './online'
import {
  getMusicUrl as getDownloadMusicUrl,
  getPicUrl as getDownloadPicUrl,
  getLyricInfo as getDownloadLyricInfo,
  resolveMusicUrl as resolveDownloadMusicUrl,
} from './download'
import {
  getMusicUrl as getLocalMusicUrl,
  getPicUrl as getLocalPicUrl,
  getLyricInfo as getLocalLyricInfo,
} from './local'


/** 解析播放地址的结果（携带实际命中的音源与实际音质） */
export interface ResolvedMusicUrl {
  url: string
  /** 实际提供该地址的歌曲信息：换源后与请求时的音乐信息不同 */
  musicInfo: LX.Music.MusicInfo
  /** 实际解析出的音质；本地文件没有音质概念，返回 '' */
  quality: LX.Quality | ''
  isFromCache: boolean
}

interface ResolveMusicUrlOptions {
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
  isRefresh?: boolean
  quality?: LX.Quality
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  allowToggleSource?: boolean
  /** 跳过当前音源、直接换源解析（播放 URL 失效 / 内容与音质不符时用） */
  forceToggleSource?: boolean
}

/**
 * 解析播放地址，并返回「实际」音源 / 音质。
 *
 * 播放器需要它把换源结果回写 toggleMusicInfo、把实际音质写进 playerState.playQuality，
 * 否则界面显示的还是「请求的音质」，和真正播放出来的文件对不上。
 */
export const resolveMusicUrl = async({
  musicInfo,
  quality,
  isRefresh = false,
  onToggleSource,
  allowToggleSource,
  forceToggleSource,
}: ResolveMusicUrlOptions): Promise<ResolvedMusicUrl> => {
  if ('progress' in musicInfo) {
    return resolveDownloadMusicUrl({ musicInfo, isRefresh, onToggleSource, allowToggleSource, forceToggleSource })
  } else if (musicInfo.source == 'local') {
    const url = await getLocalMusicUrl({ musicInfo, isRefresh, onToggleSource, allowToggleSource })
    return { url, musicInfo, quality: '', isFromCache: false }
  } else {
    return resolveOnlineMusicUrl({ musicInfo, isRefresh, quality, onToggleSource, allowToggleSource, forceToggleSource })
  }
}

export const getMusicUrl = async({
  musicInfo,
  quality,
  isRefresh = false,
  onToggleSource,
  allowToggleSource,
}: ResolveMusicUrlOptions): Promise<string> => {
  // 保留只取 url 的旧接口：preload 等不关心换源细节的调用方继续用它
  if ('progress' in musicInfo) {
    return getDownloadMusicUrl({ musicInfo, isRefresh, onToggleSource, allowToggleSource })
  } else if (musicInfo.source == 'local') {
    return getLocalMusicUrl({ musicInfo, isRefresh, onToggleSource, allowToggleSource })
  } else {
    return getOnlineMusicUrl({ musicInfo, isRefresh, quality, onToggleSource, allowToggleSource })
  }
}

export const getPicPath = async({
  musicInfo,
  isRefresh = false,
  listId,
  onToggleSource,
}: {
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
  listId?: string | null
  isRefresh?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if ('progress' in musicInfo) {
    return getDownloadPicUrl({ musicInfo, isRefresh, listId, onToggleSource })
  } else if (musicInfo.source == 'local') {
    return getLocalPicUrl({ musicInfo, isRefresh, listId, onToggleSource })
  } else {
    return getOnlinePicUrl({ musicInfo, isRefresh, listId, onToggleSource })
  }
}

export const getLyricInfo = async({
  musicInfo,
  isRefresh = false,
  onToggleSource,
}: {
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
  isRefresh?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  if ('progress' in musicInfo) {
    return getDownloadLyricInfo({ musicInfo, isRefresh, onToggleSource })
  } else if (musicInfo.source == 'local') {
    return getLocalLyricInfo({ musicInfo, isRefresh, onToggleSource })
  } else {
    return getOnlineLyricInfo({ musicInfo, isRefresh, onToggleSource })
  }
}
