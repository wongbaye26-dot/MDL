import { externalStorageDirectoryPath, temporaryDirectoryPath } from '@/utils/fs'

/**
 * 音质从高到低排序，用于音质降级查找
 */
export const QUALITYS: LX.Quality[] = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k']

export const QUALITY_LABEL: Record<LX.Quality, string> = {
  flac24bit: 'Hi-Res',
  flac: 'FLAC 无损',
  wav: 'WAV 无损',
  ape: 'APE 无损',
  '320k': '320k',
  '192k': '192k',
  '128k': '128k',
}

/** 面向用户的音质档位描述（普通/高品质/无损） */
export const QUALITY_DESC: Record<LX.Quality, string> = {
  flac24bit: 'Hi-Res 无损',
  flac: '无损音质',
  wav: '无损音质',
  ape: '无损音质',
  '320k': '高品质',
  '192k': '标准音质',
  '128k': '普通音质',
}

/** 采样率格式化为 44.1 kHz / 48 kHz */
export const formatSampleRate = (raw: string | number) => {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.]/g, ''))
  if (!n || !Number.isFinite(n)) return ''
  // 有些实现返回 kHz（如 44.1），有些返回 Hz（如 44100）
  const khz = n > 1000 ? n / 1000 : n
  return `${Number(khz.toFixed(1))} kHz`
}

const fileNameRxp = /[\\/:*?#"<>|]/g

/**
 * 过滤掉文件名中非法的字符
 */
export const filterFileName = (name: string): string => name.replace(fileNameRxp, '').trim()

/**
 * 裁剪过长的文件名，避免超出文件系统限制
 */
export const clipFileName = (name: string, maxLength = 100): string => {
  if (name.length <= maxLength) return name
  const extIndex = name.lastIndexOf('.')
  if (extIndex > 0) {
    const ext = name.substring(extIndex)
    return name.substring(0, maxLength - ext.length) + ext
  }
  return name.substring(0, maxLength)
}

export const formatMusicName = (format: string, name: string, singer: string) => {
  return format.replace('歌手', singer).replace('歌名', name)
}

/**
 * 音质 -> 文件扩展名
 */
export const getExt = (type: LX.Quality): LX.Download.FileExt => {
  switch (type) {
    case 'ape':
      return 'ape'
    case 'flac':
    case 'flac24bit':
      return 'flac'
    case 'wav':
      return 'wav'
    case '128k':
    case '192k':
    case '320k':
    default:
      return 'mp3'
  }
}

/**
 * 获取歌曲实际可下载的音质
 * 优先使用目标音质，若当前音源不支持或歌曲没有该音质则向下取
 */
export const getMusicType = (musicInfo: LX.Music.MusicInfoOnline, type: LX.Quality, qualityList: LX.QualityList): LX.Quality => {
  const list = qualityList[musicInfo.source]
  if (!list?.length) return '128k'
  if (!list.includes(type)) {
    // 取该音源支持的最低音质
    type = list[list.length - 1]
  }
  const startIndex = QUALITYS.indexOf(type)
  const rangeType = startIndex < 0 ? QUALITYS : QUALITYS.slice(startIndex)
  for (const quality of rangeType) {
    if (musicInfo.meta._qualitys?.[quality]) return quality
  }
  return list.includes('128k') ? '128k' : list[list.length - 1]
}

export const buildFileName = (musicInfo: LX.Music.MusicInfoOnline, ext: LX.Download.FileExt, format: string) => {
  const name = formatMusicName(format, musicInfo.name, musicInfo.singer)
  return clipFileName(filterFileName(`${name || musicInfo.name}.${ext}`))
}

export const buildTaskId = (musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality, ext: LX.Download.FileExt) => {
  return `${musicInfo.id}_${quality}_${ext}`
}

export const isSafPath = (path: string) => path.startsWith('content://')

export const joinPath = (dir: string, name: string) => {
  if (!dir) return name
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`
}

/**
 * 默认保存目录：公共音乐目录，无需额外权限即可被其他音乐 App 扫描到
 */
export const getDefaultSavePath = () => joinPath(externalStorageDirectoryPath, 'Music/EMOMusic')

/**
 * 公共目录不可写时的兜底目录（应用专属外部目录，卸载应用时会被清理）
 */
export const getFallbackSavePath = () => joinPath(externalStorageDirectoryPath, 'Android/data/cn.toside.music.mobile/files/Music')

/**
 * 使用 SAF 目录时，先下载到应用缓存目录，完成后再复制到目标目录
 */
export const getTempDownloadPath = () => joinPath(temporaryDirectoryPath, 'download')

export const formatSize = (size: number) => {
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export const formatSpeed = (speed: number) => {
  if (!speed) return ''
  return `${formatSize(speed)}/s`
}
