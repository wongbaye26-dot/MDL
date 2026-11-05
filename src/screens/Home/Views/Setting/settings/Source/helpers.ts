import { QUALITY_LABEL } from '@/core/download/utils'
import musicSdk from '@/utils/musicSdk'

/** 音质从高到低 */
export const QUALITY_ORDER: LX.Quality[] = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k']

export const sortQualitys = (list: LX.Quality[]): LX.Quality[] => {
  const order = (quality: LX.Quality) => {
    const index = QUALITY_ORDER.indexOf(quality)
    return index < 0 ? QUALITY_ORDER.length : index
  }
  return [...list].sort((a, b) => order(a) - order(b))
}

/** 取一组音质里最高的那个 */
export const getTopQuality = (list: LX.Quality[]): LX.Quality | null => {
  return sortQualitys(list)[0] ?? null
}

export const qualityLabel = (quality: LX.Quality): string => QUALITY_LABEL[quality] ?? quality

/** 版本号统一显示成 v1.0.0 这种形式（脚本里可能本身带 v） */
export const formatVersion = (version: string | undefined): string => {
  if (!version) return ''
  return /^\d/.test(version) ? `v${version}` : version
}

/** 时间戳显示成本地时间，空值返回空 */
export const formatTime = (timestamp: number | undefined): string => {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  } catch {
    return ''
  }
}

/** 文件大小（content-length）格式化 */
export const formatSize = (bytes: number | undefined): string => {
  if (!bytes || !Number.isFinite(bytes)) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

export const getSourceDisplayName = (source: string): string => {
  const target = (musicSdk as unknown as { sources?: Array<{ id: string, name: string }> }).sources?.find(item => item.id === source)
  return target?.name ?? source
}
