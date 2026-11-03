/* eslint-disable require-atomic-updates -- 扫描状态是模块级单例，只在扫描回调里整体更新 */
import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'
import { existsFile, extname, readDir, unlink } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getSavePath } from '@/core/download'
import {
  listAudioFiles,
  listTreeAudio,
  readAudioMeta,
  hasTreePermission,
  treeUriToDisplayPath,
  findAudioByPath,
  deleteDocument,
  type AudioMeta,
} from '@/utils/directoryPicker'
import { formatPlayTime } from '@/utils'
import { splitNameAndSinger } from '@/utils/songName'

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

/**
 * 内存缓存的写入约定（「列表显示不全，退出一下又好了」就是这里失控导致的）：
 *
 * 1. **只有完整结果才能进 `cachedList`**（扫描结束、增删改完成）。两段式扫描补标签
 *    的中途数据一律不写，否则首页 / 下载页 / 播放器会读到没有标签的半成品。
 * 2. **对外只给副本**。以前 `getLocalMusicList()` 直接 return 内部数组，页面把同一个
 *    引用放进 state；而扫描的补标签阶段是**原地**改这个数组（`list[index] = ...`）、
 *    最后还会原地 `sort()` —— 页面 state 被 core 隔空改掉却收不到通知。
 *    更致命的是扫描结束的事件传的也是同一个引用：`setList(同一个引用)` 会被 React
 *    判为「没变」直接 bail out，连重渲染都没有，列表于是永远停在半成品上；
 *    只有退出页面重新挂载（重新读缓存）才恢复 —— 正是用户报的
 *    「本地音乐列表显示不全，退出一下又可以了」。
 */

/** 发事件一律传副本：监听方不能拿到和 core 内部同一个数组引用 */
const emitLocalMusicUpdated = (list: LX.Music.MusicInfoLocal[]) => {
  global.state_event?.localMusicUpdated?.([...list])
}

/** 读取上次扫描结果（不触发扫描）。返回副本，调用方可以放心放进 state */
export const getLocalMusicList = async(): Promise<LX.Music.MusicInfoLocal[]> => {
  if (!cachedList) {
    const data = await getData<LX.Music.MusicInfoLocal[]>(STORAGE_KEY)
    // eslint-disable-next-line require-atomic-updates
    cachedList = data ?? []
  }
  return [...cachedList]
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
  } else {
    // 标签里的标题常常是「歌手 - 歌名」（下载器的命名格式），
    // 歌手已知时把歌名里的歌手摘掉，列表上只显示歌名
    name = splitNameAndSinger(name, singer).name
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
 * 现在改成两段式：先把「文件名兜底」的完整列表交出去（给本地音乐页做首次扫描的
 * 边扫边出歌），标签在后台一个个补，补的过程中节流推快照（800ms）。
 *
 * @param onUpdate 补标签过程中的快照回调。传的是**当前列表的副本**：
 *   这份数据还没补全，不能进 cachedList / 不能落盘，只能给界面做增量刷新。
 *   每 800ms 最多一次 —— 以前每补一首就整表 setState，233 首 = 233 次全列表重渲染，
 *   主线程被打满，翻页直接黑屏。
 *   补标签期间**不重排**（歌名会随标签变化，边补边排会让列表在用户眼皮底下乱跳），
 *   最后统一排一次。
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

  // 从进补标签阶段开始计时：第一首补完不要再立刻推一次
  // （刚发过「文件名兜底版」，连续两次全量快照没有意义）
  let lastEmit = Date.now()
  for (const file of targets) {
    const uri = file.meta?.contentUri
    if (!uri) continue
    // 单首读标签失败不能让整次扫描作废：233 首里只要有一个坏文件，
    // 以前会直接抛出去，整份列表都不落盘、事件也不发，界面就停在半成品
    const audioMeta = await readAudioMeta(uri).catch(() => null)
    if (audioMeta) {
      applyAudioMeta(file, audioMeta)
      const index = indexByPath.get(file.path)
      // 替换成新对象而不是原地改字段：页面 / 行组件靠对象引用判断要不要重渲染
      if (index != null) list[index] = await buildMusicInfo(file)
    }
    onProgress?.(list.length)
    const now = Date.now()
    if (onUpdate && now - lastEmit > 800) {
      lastEmit = now
      onUpdate([...list])
    }
  }
}

/**
 * 扫描所有已添加目录下的本地音频文件
 * @param onProgress 每解析完一首回调，参数为已解析数量
 * @param roots 指定要扫描的根目录，不传则用已保存的列表
 * @param onUpdate 列表的增量更新（先出文件名兜底版，标签补齐过程中持续回调）。
 *   回调里的数组是**快照副本**，不是 cachedList 本身；扫描没成功结束时不要拿它当结果。
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

  // 先把能用的列表交出去，别让用户干等标签读完。
  // 注意：这份是半成品（没有歌手/专辑/封面/时长，顺序之后还会再排一次），
  // 所以**只发给界面做增量展示，不写 cachedList、不落盘** ——
  // 否则首页 / 下载页 / 播放器会在扫描期间读到「没有标签的列表」，
  // 页面在扫描中挂载时也会拿到这份半成品，扫完还可能因为引用没变而不刷新。
  onUpdate?.([...list])

  await enrichMissingMeta(files, list, indexByPath, onProgress, onUpdate)

  list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  // 只有完整扫完才替换内存缓存并持久化：
  // 中途失败 / 被中断时 cachedList 和磁盘上都还是上一次的完整列表，
  // 不会被半截数据覆盖（用户不会「扫一半发现歌少了一半」）
  cachedList = [...list]
  try {
    await saveData(STORAGE_KEY, list)
  } finally {
    // 即使持久化失败（磁盘满等），也要把内存里的完整结果通知出去，
    // 否则界面会一直停在扫描中的半成品上
    emitLocalMusicUpdated(list)
  }
  return { list, dir: dirs[0]?.path ?? '', dirs, needAuth }
}

/** 扫描结果的总大小（字节） */
export const getTotalSize = (list: LX.Music.MusicInfoLocal[]) => {
  return list.reduce((total, item) => total + (item.meta.size ?? 0), 0)
}

/**
 * 真正把文件从磁盘上删掉，删不掉就抛错。
 *
 * 之前只调 `unlink(filePath)`：底层 `File.delete()` 失败时只返回 false、不抛异常，
 * JS 侧拿到一个「成功」，于是提示「已删除」但文件还在。
 * 现在每一步都做校验，并按「路径 → SAF 文档 uri → MediaStore」的顺序退让。
 */
const removeLocalFile = async(item: LX.Music.MusicInfoLocal) => {
  const filePath = item.meta.filePath
  if (!filePath) throw new Error('这首歌没有文件路径')

  // 直接就是 content:// 文档 uri（SAF 目录下载的文件）
  if (filePath.startsWith('content://')) {
    if (await deleteDocument(filePath)) return
    throw new Error('系统不允许删除该文件')
  }

  // 普通路径：优先走原生删除（File.delete + 清 MediaStore 索引），
  // 老版本原生包没有这个方法时再退回 unlink
  if (await deleteDocument(filePath)) return
  try {
    await unlink(filePath)
  } catch {}
  if (!await existsFile(filePath).catch(() => true)) return

  // 删不掉（分区存储 / 没有「所有文件访问」权限）→ 用文档 uri 删
  const contentUri = item.meta.contentUri ?? (await findAudioByPath(filePath))?.contentUri
  if (contentUri && await deleteDocument(contentUri)) return

  throw new Error('系统不允许删除该文件，请到设置里开启「所有文件访问」权限')
}

/**
 * 删除本地音乐文件并从列表移除
 * @param item 本地音乐信息
 * @param deleteFile 是否同时删除物理文件
 */
export const deleteLocalMusic = async(item: LX.Music.MusicInfoLocal, deleteFile: boolean): Promise<void> => {
  // 顺序很重要：**先删文件，成功了才从列表移除**。
  // 删不掉就抛错，让界面显示失败，不要出现「提示成功但文件还在」。
  if (deleteFile) await removeLocalFile(item)
  const list = await getLocalMusicList()
  const newList = list.filter(m => m.id !== item.id)
  // getLocalMusicList 给的是副本，这里赋值不会动到别的页面已经拿走的数组
  cachedList = newList
  await saveData(STORAGE_KEY, newList)
  emitLocalMusicUpdated(newList)
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
  // 整条替换成新对象：页面里行的 memo 靠引用变化决定要不要重渲染
  list[index] = updated
  cachedList = list
  await saveData(STORAGE_KEY, list)
  emitLocalMusicUpdated(list)
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
  // 传进来的是文件名（「歌手 - 歌名.flac」），歌名要把歌手摘掉再入库
  const baseName = item.name.replace(/\.[^.]+$/, '')
  // SAF 下载的 filePath 本身就是文档 uri，播放 / 抽封面都要靠 contentUri
  const contentUri = item.contentUri ?? (item.filePath.startsWith('content://') ? item.filePath : undefined)
  const entry: DirEntry = {
    name: item.name,
    path: item.filePath,
    isDirectory: false,
    size: item.size ?? 0,
    mtime: Date.now(),
    meta: {
      // 标题先用文件名（去掉扩展名、去掉歌手），扫描时会用内嵌标签覆盖
      title: splitNameAndSinger(baseName, item.singer).name,
      artist: item.singer,
      contentUri,
    },
  }
  const info = await buildMusicInfo(entry)
  const next = [...list, info]
  cachedList = next
  await saveData(STORAGE_KEY, next)
  emitLocalMusicUpdated(next)

  // 下载时已经把封面写进文件了，顺手抽出来填进曲库，
  // 不然「最近添加」「本地音乐」要等下一次重扫才有封面
  void import('./cover').then(async({ readEmbeddedCover }) => {
    const pic = await readEmbeddedCover(info).catch(() => '')
    if (pic) await updateLocalMusicPic(info.meta.filePath, pic).catch(() => {})
  }).catch(() => {})
}

/**
 * 更新某首歌的封面地址并持久化。
 * 补封面 / 联网找到封面后都要走这里，否则列表读的还是旧值。
 */
export const updateLocalMusicPic = async(filePath: string, picUrl: string): Promise<void> => {
  if (!filePath || !picUrl) return
  const list = await getLocalMusicList()
  const index = list.findIndex(m => m.meta.filePath === filePath)
  if (index < 0) return
  if (list[index].meta.picUrl === picUrl) return
  const updated = { ...list[index], meta: { ...list[index].meta, picUrl } }
  // 整条替换成新对象：页面里行的 memo 靠引用变化决定要不要重渲染
  list[index] = updated
  cachedList = list
  await saveData(STORAGE_KEY, list)
  emitLocalMusicUpdated(list)
}

/* ───────────────────────── 后台静默扫描 ───────────────────────── */

/**
 * 扫描状态放在模块级，而不是组件 state：
 * 本地音乐页在 PagerView 里，切到别的页时组件会卸载，
 * 状态跟着组件走的话「扫描中」就断了，回来还得重扫；而且扫描途中 setState
 * 会触发整张 187 行的列表重渲染，滑动直接卡死（用户看到的「黑屏」）。
 */
interface ScanState {
  scanning: boolean
  progress: number
}

let scanState: ScanState = { scanning: false, progress: 0 }
const scanListeners = new Set<() => void>()
let scanEmitTimer: ReturnType<typeof setTimeout> | null = null

const emitScan = () => {
  for (const listener of scanListeners) listener()
}

/** 进度刷新节流：每 250ms 最多通知一次，别让 186 首歌打 186 次渲染 */
const updateScanProgress = (count: number) => {
  scanState.scanning = true
  scanState.progress = count
  emitScanThrottled()
}

const emitScanThrottled = () => {
  if (scanEmitTimer) return
  scanEmitTimer = setTimeout(() => {
    scanEmitTimer = null
    emitScan()
  }, 250)
}

export const getScanState = () => scanState

export const subscribeScanState = (listener: () => void) => {
  scanListeners.add(listener)
  return () => { scanListeners.delete(listener) }
}

/* ───── 扫描中的「半成品」列表快照 ───── */

/**
 * 为什么单独做一套本地订阅、不复用 `localMusicUpdated` 全局事件：
 * 那个事件首页 / 下载页 / 播放器都在监听，扫描期间每 800ms 广播一次，
 * 会让首页的歌曲流跟着重渲染 —— 上一版「扫描中切页黑屏」就是全量列表高频刷新造成的。
 * 扫描期间真正需要实时刷新的只有本地音乐页自己（首次扫描时边扫边出歌）。
 */
let scanPartialList: LX.Music.MusicInfoLocal[] | null = null
const scanPartialListeners = new Set<() => void>()

/** 扫描中的列表快照（没有扫描时是 null）。页面挂载时先读一次拿当前进度 */
export const getScanPartialList = () => scanPartialList

/** 订阅扫描中的列表快照（只有本地音乐页订阅；扫描结束这里就清空） */
export const subscribeScanPartialList = (listener: () => void) => {
  scanPartialListeners.add(listener)
  return () => { scanPartialListeners.delete(listener) }
}

const publishScanPartial = (list: LX.Music.MusicInfoLocal[]) => {
  scanPartialList = [...list]
  for (const listener of scanPartialListeners) listener()
}

const clearScanPartial = () => {
  scanPartialList = null
}

/** 组件里读扫描状态 */
export const useScanState = () => {
  const [state, setState] = useState<ScanState>(scanState)
  useEffect(() => subscribeScanState(() => { setState({ ...scanState }) }), [])
  return state
}

/** 扫描中返回 false（防止重复触发） */
export const isScanning = () => scanState.scanning

/**
 * 后台静默扫描：不依赖任何页面存活。
 * 扫描状态放模块级；进度节流 250ms，列表快照节流 800ms（见 enrichMissingMeta），
 * 扫完再发一次最终结果。
 */
export const scanLocalMusicInBackground = async(roots?: ScanDir[]): Promise<ScanResult | null> => {
  if (scanState.scanning) return null
  scanState = { scanning: true, progress: 0 }
  emitScan()
  clearScanPartial()
  try {
    const result = await scanLocalMusic(
      count => {
        updateScanProgress(count)
      },
      roots,
      /*
        扫描期间把「文件名兜底版」和补标签进度推给本地音乐页（内部已节流、只走本地订阅）。

        以前这里完全不推：页面在扫描中挂载的话，要么只看到旧列表、要么看到
        core 里那份正在被原地修改的半成品；扫完那一次事件又可能是同一个数组引用，
        被 React bail out 掉，界面就停在半成品上（用户报的「显示不全，退出一下又好了」）。
        现在半成品只给本地音乐页做「首次扫描边扫边出歌」，
        扫完的最终结果仍然走全局事件（首页的「最近添加」要跟着刷新）。
      */
      publishScanPartial,
    )
    return result
  } catch (err) {
    // 扫描失败 / 中断：把内存里上一次的完整列表再广播一次。
    // 首次扫描时页面可能正显示着半成品，必须让它落回完整数据（而不是停在半截）。
    if (cachedList) emitLocalMusicUpdated(cachedList)
    throw err
  } finally {
    scanState = { scanning: false, progress: 0 }
    clearScanPartial()
    if (scanEmitTimer) {
      clearTimeout(scanEmitTimer)
      scanEmitTimer = null
    }
    emitScan()
  }
}
