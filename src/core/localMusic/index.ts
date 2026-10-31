import { getData, saveData } from '@/plugins/storage'
import { extname, readDir } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getSavePath } from '@/core/download'
import { formatPlayTime } from '@/utils'

/** 持久化存储键 */
const STORAGE_KEY = 'local_music_list'
/** 支持的音频扩展名 */
const AUDIO_EXT = new Set(['mp3', 'flac', 'm4a', 'aac', 'wav', 'ogg', 'ape', 'wma', 'opus', 'dsf', 'dff'])
/** 递归扫描的最大层级 */
const MAX_DEPTH = 4

/** ls 返回的目录项（原生模块未给类型，这里显式声明用到的字段） */
interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

/** 音频标签信息 */
interface AudioMetadata {
  name?: string
  singer?: string
  albumName?: string
  interval?: number
  bitrate?: string
}

let cachedList: LX.Music.MusicInfoLocal[] | null = null

/** 读取上次扫描结果（不触发扫描） */
export const getLocalMusicList = async(): Promise<LX.Music.MusicInfoLocal[]> => {
  if (cachedList) return cachedList
  const data = await getData<LX.Music.MusicInfoLocal[]>(STORAGE_KEY)
  // eslint-disable-next-line require-atomic-updates
  cachedList = data ?? []
  return cachedList
}

/** 清掉内存缓存，下次重新读存储 */
export const clearLocalMusicCache = () => {
  cachedList = null
}

const walk = async(dir: string, depth: number, out: DirEntry[]) => {
  if (depth > MAX_DEPTH) return
  let files: DirEntry[]
  try {
    files = await readDir(dir) as DirEntry[]
  } catch {
    return
  }
  for (const file of files) {
    const name = file.name ?? ''
    if (!name || name.startsWith('.')) continue
    if (file.isDirectory) {
      await walk(file.path, depth + 1, out)
      continue
    }
    if (AUDIO_EXT.has(extname(name).toLowerCase())) out.push(file)
  }
}

const buildMusicInfo = async(file: DirEntry): Promise<LX.Music.MusicInfoLocal> => {
  const filePath = file.path
  const ext = extname(file.name).toLowerCase()
  const baseName = file.name.replace(/\.[^.]+$/, '')

  let metadata: AudioMetadata | null = null
  try {
    metadata = await readMetadata(filePath) as AudioMetadata | null
  } catch {}

  let name = metadata?.name?.trim() ?? ''
  let singer = metadata?.singer?.trim() ?? ''
  if (!name) {
    // 没有标签信息时，用「歌手 - 歌名」的文件名拆分兜底
    const match = /^(.+?)\s*[-–—]\s*(.+)$/.exec(baseName)
    if (match) {
      name = match[2].trim()
      singer = match[1].trim()
    } else {
      name = baseName
    }
  }

  return {
    id: `local_${filePath}`,
    name,
    singer,
    source: 'local',
    interval: metadata?.interval ? formatPlayTime(metadata.interval) : null,
    meta: {
      songId: filePath,
      albumName: metadata?.albumName ?? '',
      filePath,
      ext,
      size: file.size,
      bitrate: metadata?.bitrate,
    },
  }
}

export interface ScanResult {
  list: LX.Music.MusicInfoLocal[]
  dir: string
}

/**
 * 扫描下载目录下的本地音频文件
 * @param onProgress 每解析完一首回调，参数为已解析数量
 */
export const scanLocalMusic = async(onProgress?: (count: number) => void): Promise<ScanResult> => {
  const dir = await getSavePath()
  const files: DirEntry[] = []
  await walk(dir, 0, files)

  const list: LX.Music.MusicInfoLocal[] = []
  const seen = new Set<string>()
  for (const file of files) {
    if (seen.has(file.path)) continue
    seen.add(file.path)
    list.push(await buildMusicInfo(file))
    onProgress?.(list.length)
  }

  list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  cachedList = list
  await saveData(STORAGE_KEY, list)
  return { list, dir }
}

/** 扫描结果的总大小（字节） */
export const getTotalSize = (list: LX.Music.MusicInfoLocal[]) => {
  return list.reduce((total, item) => total + (item.meta.size ?? 0), 0)
}
