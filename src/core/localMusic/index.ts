import { getData, saveData } from '@/plugins/storage'
import { extname, readDir } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getSavePath } from '@/core/download'
import { listAudioFiles, listTreeAudio, readAudioMeta, hasTreePermission, treeUriToDisplayPath, type AudioMeta } from '@/utils/directoryPicker'
import { formatPlayTime } from '@/utils'

/** 持久化存储键 */
const STORAGE_KEY = 'local_music_list'
/** 用户额外添加的扫描目录 */
const DIRS_KEY = 'local_music_dirs'
/** 应用自己的目录可以直接读；公共目录要走 MediaStore / SAF */
const isAppPrivateDir = (dir: string) => dir.includes('/Android/data/') || dir.includes('/Android/obb/')

/** 一个扫描根目录 */
export interface ScanDir {
  path: string
  /**
   * SAF 的 tree uri。
   * 有它就能直接枚举目录（连系统没索引的文件也能列出来），
   * 老数据 / 默认下载目录没有，只能退回 MediaStore。
   */
  treeUri?: string
}

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
  /** MediaMetadataRetriever 读到的采样率/码率/标签 */
  audioMeta?: AudioMeta
  /** 来自 MediaStore / SAF 时，已有的元数据 */
  meta?: {
    title?: string
    artist?: string
    album?: string
    /** 毫秒 */
    duration?: number
    /** 封面（content:// albumart 或缓存里的 file://） */
    picUrl?: string
    /** 交给播放器的 uri：content:// 文档 uri 或 MediaStore 媒体 uri */
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
  if (file.audioMeta != null || file.meta != null) {
    // 系统索引（MediaStore）和文件标签（MediaMetadataRetriever）各有胜场：
    // 前者标题规范、后者一定有值（SAF 独有文件只读得到后者），按优先级合并。
    const am = file.audioMeta
    const m = file.meta
    /** 取第一个非空值（空串也算没值，避免显示成空白） */
    const pick = (a?: string, b?: string) => (a != null && a !== '' ? a : b)
    const interval = (m?.duration ?? am?.duration)
    metadata = {
      name: pick(m?.title, am?.title),
      singer: pick(m?.artist, am?.artist),
      albumName: pick(m?.album, am?.album),
      interval: interval ? interval / 1000 : undefined,
      bitrate: am?.bitrate ? String(Math.round(am.bitrate / 1000)) : undefined,
      sampleRate: am?.sampleRate ? String(am.sampleRate) : undefined,
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
      contentUri: file.meta?.contentUri,
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
  dirs: ScanDir[]
  /**
   * 扫不出任何歌、又没有 SAF 授权的目录。
   * 这类目录（老版本加进来的）只能靠系统索引，索引不到就永远是 0 首，
   * 必须让用户重新选一次目录才能拿到授权。
   */
  needAuth: ScanDir[]
}

/** 老版本存的是纯字符串数组，这里做一次归一化 */
const normalizeDirs = (raw: unknown): ScanDir[] => {
  if (!Array.isArray(raw)) return []
  const out: ScanDir[] = []
  for (const item of raw as Array<string | ScanDir>) {
    if (typeof item === 'string') {
      if (item) out.push({ path: item })
    } else if (item && typeof item.path === 'string' && item.path) {
      out.push({ path: item.path, treeUri: item.treeUri })
    }
  }
  return out
}

/**
 * 扫描目录列表（完全由用户管理）。
 * 首次使用时用下载目录播种一次，之后用户想删就删 —— 不再有「默认目录」的概念。
 */
export const getExtraDirs = async(): Promise<ScanDir[]> => {
  const dirs = normalizeDirs(await getData<unknown>(DIRS_KEY))
  if (dirs.length) return dirs
  let base = ''
  try {
    base = await getSavePath()
  } catch {}
  let seed: ScanDir[] = []
  if (base) {
    // 下载目录可能是 SAF 授权目录（content://），播种时要还原成路径 + treeUri，
    // 否则后面拿它去 MediaStore 查是查不到的
    seed = base.startsWith('content://')
      ? [{ path: treeUriToDisplayPath(base), treeUri: base }]
      : [{ path: base }]
  }
  await saveData(DIRS_KEY, seed)
  return seed
}

export const setExtraDirs = async(dirs: ScanDir[]) => {
  const seen = new Set<string>()
  const next: ScanDir[] = []
  for (const dir of dirs) {
    if (!dir?.path || seen.has(dir.path)) continue
    seen.add(dir.path)
    next.push({ path: dir.path, treeUri: dir.treeUri })
  }
  await saveData(DIRS_KEY, next)
}

/** 全部扫描根目录（就是用户管理的那份列表） */
export const getScanDirs = async(): Promise<ScanDir[]> => getExtraDirs()

/** 把 AudioMeta 合并进条目（标签/时长/封面/码率） */
const applyAudioMeta = (entry: DirEntry, audioMeta: AudioMeta) => {
  const meta = entry.meta ?? (entry.meta = {})
  if (!meta.title && audioMeta.title) meta.title = audioMeta.title
  if (!meta.artist && audioMeta.artist) meta.artist = audioMeta.artist
  if (!meta.album && audioMeta.album) meta.album = audioMeta.album
  if (!meta.duration && audioMeta.duration) meta.duration = audioMeta.duration
  // 抽出来的内嵌封面优先于 albumart（后者在 Android 10+ 常常读不出来）
  if (audioMeta.cover) meta.picUrl = audioMeta.cover
  entry.audioMeta = audioMeta
}

/**
 * 公共目录扫描：SAF 枚举（准）+ MediaStore 元数据（快）。
 *
 * 只用 MediaStore 会漏歌 —— 用户自己拷进来的目录系统经常不索引；
 * 只用 SAF 又拿不到系统整理的标题/专辑封面。所以以 SAF 的文件清单为准，
 * 用 MediaStore 的结果按路径补元数据，SAF 独有的再走 MediaMetadataRetriever。
 */
const collectPublicDir = async(dir: ScanDir, out: DirEntry[], onProgress?: (count: number) => void) => {
  const msItems = await listAudioFiles(dir.path).catch(() => [])
  const treeItems = dir.treeUri ? await listTreeAudio(dir.treeUri) : []

  if (!treeItems.length) {
    if (!msItems.length) {
      // 既没有 SAF 授权也没有系统索引，最后试一次文件系统（私有目录/老系统可行）
      await walk(dir.path, 0, out)
      return
    }
    for (const item of msItems) {
      out.push({
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
    return
  }

  const msByPath = new Map(msItems.map(item => [item.path, item]))
  for (const item of treeItems) {
    const path = item.path ?? `${dir.path}/${item.name}`
    const ms = msByPath.get(path)
    const entry: DirEntry = {
      name: item.name,
      path,
      isDirectory: false,
      size: item.size > 0 ? item.size : (ms?.size ?? 0),
      mtime: item.mtime > 0 ? item.mtime : (ms?.mtime ?? 0),
      meta: {
        title: ms?.title,
        artist: ms?.artist,
        album: ms?.album,
        duration: ms?.duration,
        picUrl: ms?.albumArt,
        // SAF 文档 uri 是「一定存在且一定能读」的播放地址，
        // 系统没索引这个文件时只有它能救场（按路径打开会 EACCES）
        contentUri: item.uri ?? ms?.contentUri,
      },
    }
    out.push(entry)
    onProgress?.(out.length)
  }
}

/**
 * 后台补齐标签。
 *
 * 逐个文件读标签（MediaMetadataRetriever）是扫描里最贵的一步：
 * 上千首的目录要跑好几分钟，原来的做法是「给个预算，超出就放弃」——
 * 结果超出预算的歌永远只有文件名、没有歌手和封面。
 * 现在改成两段式：先把「文件名兜底」的完整列表交出去，用户能立刻开始用，
 * 标签在后台一个个补，边补边增量刷新列表（节流 400ms）。
 */
const enrichMissingMeta = async(
  files: DirEntry[],
  list: LX.Music.MusicInfoLocal[],
  indexByPath: Map<string, number>,
  onProgress?: (count: number) => void,
  onUpdate?: (list: LX.Music.MusicInfoLocal[]) => void,
) => {
  const targets = files.filter(file => file.meta?.contentUri != null && file.audioMeta == null)
  if (!targets.length) return

  let lastEmit = 0
  for (const file of targets) {
    const uri = file.meta?.contentUri
    if (!uri) continue
    const audioMeta = await readAudioMeta(uri)
    if (audioMeta) {
      applyAudioMeta(file, audioMeta)
      const index = indexByPath.get(file.path)
      if (index != null) list[index] = await buildMusicInfo(file)
    }
    onProgress?.(list.length)
    const now = Date.now()
    if (onUpdate && now - lastEmit > 600) {
      lastEmit = now
      // 补标签过程中不要重排：歌名会随着标签补全而变化，
      // 每次都重排会让列表在用户眼皮底下乱跳，最后统一排一次即可
      onUpdate([...list])
    }
  }
  onUpdate?.([...list])
}

/**
 * 扫描所有已添加目录下的本地音频文件
 * @param onProgress 每解析完一首回调，参数为已解析数量
 * @param roots 指定要扫描的根目录，不传则用已保存的列表
 * @param onUpdate 列表的增量更新（先出文件名兜底版，标签补齐过程中持续回调）
 */
export const scanLocalMusic = async(
  onProgress?: (count: number) => void,
  roots?: ScanDir[],
  onUpdate?: (list: LX.Music.MusicInfoLocal[]) => void,
): Promise<ScanResult> => {
  const dirs = roots?.length ? roots : await getScanDirs()
  const files: DirEntry[] = []
  const needAuth: ScanDir[] = []
  for (const dir of dirs) {
    // 兜底：万一存进来的是 content:// 目录树，先还原成路径（MediaStore 只认路径）
    const isTree = dir.path.startsWith('content://')
    const plainDir: ScanDir = isTree
      ? { path: treeUriToDisplayPath(dir.path), treeUri: dir.treeUri ?? dir.path }
      : dir
    const before = files.length
    // 授权失效（清存储 / 重装 / 手动撤销）：SAF 枚举只会静默返回空，
    // 不先探一次的话用户会以为「歌全没了」
    if (plainDir.treeUri && !await hasTreePermission(plainDir.treeUri)) {
      needAuth.push(plainDir)
      continue
    }
    // 应用私有目录（下载目录）可以直接读文件系统；
    // 用户额外添加的公共目录在分区存储下不能 listFiles()，走 SAF + MediaStore。
    if (isAppPrivateDir(plainDir.path)) {
      await walk(plainDir.path, 0, files)
    } else {
      await collectPublicDir(plainDir, files, onProgress)
    }
    if (files.length === before && !plainDir.treeUri) needAuth.push(plainDir)
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
  // 注意：索引必须在排序之后建，否则补标签时会写到错位的槽位上
  const indexByPath = new Map<string, number>()
  list.forEach((item, i) => { indexByPath.set(item.meta.filePath, i) })

  cachedList = list
  // 先把能用的列表交出去，别让用户干等标签读完（传副本，后面还会原地更新）
  onUpdate?.([...list])

  await enrichMissingMeta(files, list, indexByPath, onProgress, onUpdate)

  list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  cachedList = list
  await saveData(STORAGE_KEY, list)
  // 通知首页等外部视图刷新（「最近添加歌曲」按 mtime 取，扫描完要跟着变）
  global.state_event?.localMusicUpdated?.(list)
  return { list, dir: dirs[0]?.path ?? '', dirs, needAuth }
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
  global.state_event?.localMusicUpdated?.(newList)
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
  global.state_event?.localMusicUpdated?.([...list])
}

/**
 * 下载完成后把单个文件收进本地曲库。
 *
 * 不走整库重扫（186 首要 30 秒），直接构造一条记录插进去 ——
 * 下载中心下完的歌立刻就能在「本地音乐」和首页「最近添加」里看到。
 */
export const addLocalMusicFile = async(item: {
  filePath: string
  name: string
  singer?: string
  size?: number
  contentUri?: string
}) => {
  if (!item.filePath) return
  const list = await getLocalMusicList()
  if (list.some(m => m.meta.filePath === item.filePath)) return
  const entry: DirEntry = {
    name: item.name,
    path: item.filePath,
    isDirectory: false,
    size: item.size ?? 0,
    mtime: Date.now(),
    meta: {
      // 标题先用文件名（去掉扩展名），扫描时会用内嵌标签覆盖
      title: item.name.replace(/\.[^.]+$/, ''),
      artist: item.singer,
      contentUri: item.contentUri,
    },
  }
  const info = await buildMusicInfo(entry)
  const next = [...list, info]
  cachedList = next
  await saveData(STORAGE_KEY, next)
  global.state_event?.localMusicUpdated?.(next)
}
