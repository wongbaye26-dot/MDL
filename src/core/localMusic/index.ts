import { getData, saveData } from '@/plugins/storage'
import { extname, readDir } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getSavePath } from '@/core/download'
import { listAudioFiles, readAudioMeta } from '@/utils/directoryPicker'
import { formatPlayTime } from '@/utils'

/** 持久化存储键 */
const STORAGE_KEY = 'local_music_list'
/** 用户额外添加的扫描目录 */
const DIRS_KEY = 'local_music_dirs'
/** 应用自己的目录可以直接读；公共目录要走 MediaStore */
const isAppPrivateDir = (dir: string) => dir.includes('/Android/data/') || dir.includes('/Android/obb/')

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
  /** react-native-fs 的 readDir 会给，可能是 Date 也可能是秒级时间戳 */
  mtime?: number | Date
  /** MediaMetadataRetriever 读到的采样率/码率 */
  audioMeta?: { duration?: number, bitrate?: number, sampleRate?: number }
  /** 来自 MediaStore 时，系统索引里已有的元数据 */
  meta?: {
    title?: string
    artist?: string
    album?: string
    /** 毫秒 */
    duration?: number
    /** content://media/external/audio/albumart/<id> */
    picUrl?: string
    contentUri?: string
  }
}

/** 音频标签信息 */
interface AudioMetadata {
  name?: string
  singer?: string
  albumName?: string
  interval?: number
  bitrate?: string
  sampleRate?: string
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
  if (file.audioMeta) {
    metadata = {
      ...(file.meta ? {
        name: file.meta.title,
        singer: file.meta.artist,
        albumName: file.meta.album,
        interval: file.meta.duration ? file.meta.duration / 1000 : undefined,
      } : {}),
      bitrate: file.audioMeta.bitrate ? String(Math.round(file.audioMeta.bitrate / 1000)) : undefined,
      sampleRate: file.audioMeta.sampleRate ? String(file.audioMeta.sampleRate) : undefined,
    }
  } else if (file.meta) {
    // 来自 MediaStore 的条目：系统索引里已经有标题/歌手/专辑/时长，
    // 而且公共目录的文件本身读不了，直接用索引里的值
    metadata = {
      name: file.meta.title,
      singer: file.meta.artist,
      albumName: file.meta.album,
      interval: file.meta.duration ? file.meta.duration / 1000 : undefined,
    }
  } else {
    try {
      metadata = await readMetadata(filePath) as AudioMetadata | null
    } catch {}
  }

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
      picUrl: file.meta?.picUrl,
      // readDir 可能给 Date / 秒 / 毫秒，统一成毫秒
      mtime: (() => {
        const v = file.mtime
        if (!v) return 0
        if (v instanceof Date) return v.getTime()
        return v < 1e12 ? v * 1000 : v
      })(),
      songId: filePath,
      albumName: metadata?.albumName ?? '',
      filePath,
      ext,
      size: file.size,
      bitrate: metadata?.bitrate,
      sampleRate: metadata?.sampleRate,
    },
  }
}

export interface ScanResult {
  list: LX.Music.MusicInfoLocal[]
  dir: string
  /** 这次实际扫描的所有根目录 */
  dirs: string[]
}

/**
 * 扫描目录列表（完全由用户管理）。
 * 首次使用时用下载目录播种一次，之后用户想删就删 —— 不再有「默认目录」的概念。
 */
export const getExtraDirs = async(): Promise<string[]> => {
  const dirs = await getData<string[]>(DIRS_KEY)
  if (Array.isArray(dirs)) return dirs
  let base = ''
  try {
    base = await getSavePath()
  } catch {}
  const seed = base ? [base] : []
  await saveData(DIRS_KEY, seed)
  return seed
}

export const setExtraDirs = async(dirs: string[]) => {
  await saveData(DIRS_KEY, [...new Set(dirs.filter(Boolean))])
}

/** 全部扫描根目录（就是用户管理的那份列表） */
export const getScanDirs = async(): Promise<string[]> => {
  const dirs = await getExtraDirs()
  return [...new Set(dirs.filter(Boolean))]
}

/**
 * 扫描下载目录下的本地音频文件
 * @param onProgress 每解析完一首回调，参数为已解析数量
 */
export const scanLocalMusic = async(
  onProgress?: (count: number) => void,
  roots?: string[],
): Promise<ScanResult> => {
  const dirs = roots?.length ? roots : await getScanDirs()
  const files: DirEntry[] = []
  for (const dir of dirs) {
    // 应用私有目录（下载目录）可以直接读文件系统；
    // 用户额外添加的公共目录在分区存储下不能 listFiles()，必须走 MediaStore 索引。
    if (isAppPrivateDir(dir)) {
      await walk(dir, 0, files)
    } else {
      const list = await listAudioFiles(dir).catch(() => [])
      if (!list.length) {
        // 系统还没索引这个目录（刚放进去的文件），退回文件系统扫一遍试试
        await walk(dir, 0, files)
        continue
      }
      for (const item of list) {
        files.push({
          name: item.name,
          path: item.path,
          isDirectory: false,
          size: item.size,
          mtime: item.mtime,
          meta: {
            title: item.title,
            artist: item.artist,
            album: item.album,
            duration: item.duration,
            picUrl: item.albumArt,
            contentUri: item.contentUri,
          },
        })
      }
      // MediaStore 里没有采样率/码率，用 MediaMetadataRetriever 逐个补（最多补 300 个，避免太慢）
      if (list.length && list.length <= 300) {
        for (const file of files.slice(-list.length)) {
          const uri = file.meta?.contentUri
          if (!uri) continue
          const audioMeta = await readAudioMeta(uri)
          if (!audioMeta) continue
          file.meta!.duration = audioMeta.duration ?? file.meta!.duration
          // 抽出来的内嵌封面优先于 albumart（后者在 Android 10+ 常常读不出来）
          if (audioMeta.cover) file.meta!.picUrl = audioMeta.cover
          ;(file as DirEntry & { audioMeta?: typeof audioMeta }).audioMeta = audioMeta
        }
      }
    }
  }

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
  return { list, dir: dirs[0] ?? '', dirs }
}

/** 扫描结果的总大小（字节） */
export const getTotalSize = (list: LX.Music.MusicInfoLocal[]) => {
  return list.reduce((total, item) => total + (item.meta.size ?? 0), 0)
}

/**
 * 删除本地音乐文件并从列表移除
 * @param item 本地音乐信息
 * @param deleteFile 是否同时删除物理文件
 */
export const deleteLocalMusic = async(item: LX.Music.MusicInfoLocal, deleteFile: boolean): Promise<void> => {
  const list = await getLocalMusicList()
  const newList = list.filter(m => m.id !== item.id)
  cachedList = newList
  await saveData(STORAGE_KEY, newList)
  if (deleteFile && item.meta.filePath) {
    try {
      const RNFS = await import('react-native-fs')
      await RNFS.unlink(item.meta.filePath)
    } catch {}
  }
}

/**
 * 更新本地音乐的元信息（名称、歌手、专辑）
 * 仅更新缓存和持久化，不写入物理文件标签
 */
export const updateLocalMusicMeta = async(item: LX.Music.MusicInfoLocal, updates: {
  name?: string
  singer?: string
  albumName?: string
}): Promise<void> => {
  const list = await getLocalMusicList()
  const index = list.findIndex(m => m.id === item.id)
  if (index < 0) return
  const updated = { ...list[index] }
  if (updates.name !== undefined) updated.name = updates.name
  if (updates.singer !== undefined) updated.singer = updates.singer
  if (updates.albumName !== undefined) updated.meta = { ...updated.meta, albumName: updates.albumName }
  list[index] = updated
  cachedList = list
  await saveData(STORAGE_KEY, list)
}
