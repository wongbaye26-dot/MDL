/* eslint-disable require-atomic-updates -- 扫描状态是模块级单例，只在扫描回调里整体更新 */
import { canReuseScannedFile } from './scanDiff'
import { scheduleShadowSync } from '@/core/localLibrary/shadow'
import { getReadSource, readLibraryFromRepository } from '@/core/localLibrary/readSource'
import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'
import { existsFile, extname, readDir, unlink } from '@/utils/fs'
import { readMetadata } from '@/utils/localMediaMetadata'
import { getSavePath } from '@/core/download'
import { getDefaultSavePath, getFallbackSavePath } from '@/core/download/utils'
import {
  listAudioFiles,
  listTreeAudio,
  readAudioMeta,
  hasTreePermission,
  treeUriToDisplayPath,
  findAudioByPath,
  deleteDocument,
  type AudioMeta,
  type AudioFileItem,
} from '@/utils/directoryPicker'
import { formatPlayTime } from '@/utils'
import { splitNameAndSinger } from '@/utils/songName'
import { log } from '@/utils/log'
import { resolveDownloadedCover } from './cover'

/** 持久化存储键 */
const STORAGE_KEY = 'local_music_list'

/** 曲库写盘统一入口：旧 JSON 保存后异步写 SQLite 影子表（失败不影响主流程） */
const saveLocalMusicList = async(list: LX.Music.MusicInfoLocal[]) => {
  await saveData(STORAGE_KEY, list)
  scheduleShadowSync(list)
}
/** 用户额外添加的扫描目录 */
const DIRS_KEY = 'local_music_dirs'
/**
 * 「刚下载、还没被扫描确认」的曲库条目。
 *
 * 为什么要单独存一份：下载完成时 addLocalMusicFile 会把歌直接插进曲库，
 * 但原生 MediaStore 索引 / SAF 枚举可能还有延迟，下一次整库扫描如果没扫到它，
 * cachedList 就被扫描结果整体覆盖 —— 用户看到的就是「下载好的歌重扫一下又没了」。
 * 这里把这类条目暂存起来：扫描结果里没有、但文件确实还在的，合并回列表；
 * 一旦扫描自己能发现它，就从暂存里删掉，不会无限堆积。
 */
const PENDING_KEY = 'local_music_pending_added'
/** 最近一次扫描报告（增量统计/失败/失权） */
const SCAN_REPORT_KEY = 'local_music_scan_report_v1'
/** 暂存条目最长保留时间：超过还没被任何一次扫描确认就丢弃（防止僵尸条目） */
const PENDING_TTL = 7 * 24 * 60 * 60 * 1000
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
/** 同步读取已加载到内存的曲库（启动预加载后可用）；未加载返回 null */
export const getLocalMusicListSync = (): LX.Music.MusicInfoLocal[] | null => {
  return cachedList ? [...cachedList] : null
}

/** 启动首屏快照：只读 JSON 缓存，不等 SQLite（随后 getLocalMusicList 会用 DB 权威数据覆盖） */
export const getLocalMusicListCacheOnly = async(): Promise<LX.Music.MusicInfoLocal[]> => {
  const data = await getData<LX.Music.MusicInfoLocal[]>(STORAGE_KEY).catch(() => null)
  return data ?? []
}

export const getLocalMusicList = async(): Promise<LX.Music.MusicInfoLocal[]> => {
  if (!cachedList) {
    const source = await getReadSource()
    if (source === 'repository') {
      const dbList = await readLibraryFromRepository().catch(() => [])
      // DB 未初始化/迁移未完成时回退 JSON，避免升级后曲库突然变空
      if (dbList.length) cachedList = dbList
    }
    if (!cachedList) {
      const data = await getData<LX.Music.MusicInfoLocal[]>(STORAGE_KEY)
      cachedList = data ?? []
    }
  }
  return [...cachedList]
}

/** 清掉内存缓存，下次重新读存储 */
/** A-3：按映射改写曲库条目 id（主键迁移用；不触发影子同步，DB 已单独迁移） */
export const rewriteLocalMusicIds = async(mapping: Map<string, string>): Promise<number> => {
  const list = await getLocalMusicList()
  let changed = 0
  const next = list.map(item => {
    const newId = mapping.get(item.id)
    if (!newId || newId === item.id) return item
    changed += 1
    return { ...item, id: newId }
  })
  if (!changed) return 0
  cachedList = next
  await saveData(STORAGE_KEY, next)
  emitLocalMusicUpdated(next)
  return changed
}

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

export interface ScanReport {
  finishedAt: number
  durationMs: number
  /** 扫描后曲库总数 */
  total: number
  /** 新增文件数（曲库里原来没有的路径） */
  added: number
  /** 文件变了、重新读了标签的数量 */
  updated: number
  /** 路径和 mtime/size 都没变、直接复用缓存条目的数量 */
  unchanged: number
  /** 上次有、这次扫描后不在曲库里的数量（删除/失权） */
  removed: number
  /** 读标签/构建条目失败的数量 */
  failed: number
  needAuth: string[]
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
  /** 增量统计报告 */
  report?: ScanReport
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
 * 下载目录本身就是本地音乐的第一个扫描根目录，且不写进用户目录列表。
 * 这样下载目录改了（默认目录 / 重新授权 / SAF）之后，本地音乐会自动跟着走，
 * 不会再残留一个旧的 Android/data 兜底目录。
 */
const getDownloadScanDir = async(): Promise<ScanDir | null> => {
  let base = ''
  try {
    base = await getSavePath()
  } catch {}
  if (!base) return null
  // 下载目录可能是 SAF 授权目录（content://），要还原成路径 + treeUri，
  // 否则后面拿它去 MediaStore 查是查不到的
  return base.startsWith('content://')
    ? { path: treeUriToDisplayPath(base), treeUri: base }
    : { path: base }
}

/** v3.6.3 之前播种过的默认下载目录：旧兜底/android/data、旧品牌 Music/EMOMusic 等 */
const isStaleDefaultDir = (path: string) => {
  const clean = path.replace(/\/+$/, '')
  return clean === getDefaultSavePath() ||
    clean === getFallbackSavePath() ||
    /\/Android\/data\/[^/]+\/files\/Music$/.test(clean) ||
    /\/Music\/(EMOMusic|EmoMusic)$/.test(clean)
}

/**
 * 用户额外添加的扫描目录（不含下载目录）。
 * 老数据里可能混有之前播种进去的默认下载目录，读取时过滤掉。
 */
export const getExtraDirs = async(): Promise<ScanDir[]> => {
  return normalizeDirs(await getData<unknown>(DIRS_KEY)).filter(dir => !isStaleDefaultDir(dir.path))
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

/** 读取「刚下载、还没被扫描确认」的曲库条目（见 PENDING_KEY 注释） */
const getPendingAdded = async(): Promise<LX.Music.MusicInfoLocal[]> => {
  const data = await getData<LX.Music.MusicInfoLocal[]>(PENDING_KEY)
  return Array.isArray(data) ? data : []
}

const savePendingAdded = async(list: LX.Music.MusicInfoLocal[]) => {
  await saveData(PENDING_KEY, list)
}

/** 全部扫描根目录：当前下载目录 + 用户额外目录，去重 */
export const getScanDirs = async(): Promise<ScanDir[]> => {
  const downloadDir = await getDownloadScanDir()
  const dirs = [downloadDir, ...await getExtraDirs()]
  const seen = new Set<string>()
  const out: ScanDir[] = []
  for (const dir of dirs) {
    if (!dir?.path || seen.has(dir.path)) continue
    seen.add(dir.path)
    out.push(dir)
  }
  return out
}

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
 * 公共目录扫描：目录直读 + SAF 枚举 + MediaStore 元数据，三路合并。
 *
 * 只用 MediaStore 会漏歌 —— 刚下载完 / 用户自己拷进来的文件系统经常还没索引；
 * 只用 SAF 又拿不到系统整理的标题/专辑封面；
 * 只用目录直读则在分区存储下根本列不出公共目录。
 * 所以以「文件清单」为准（直读 + SAF 取并集），用 MediaStore 的结果按路径补元数据，
 * 直读到的、系统还没索引的文件再走 MediaMetadataRetriever（有「所有文件访问」权限时可读）。
 */
const collectPublicDir = async(dir: ScanDir, out: DirEntry[], onProgress?: (count: number) => void) => {
  const msItems = await listAudioFiles(dir.path).catch(() => [])
  const treeItems = dir.treeUri ? await listTreeAudio(dir.treeUri) : []

  const msByPath = new Map(msItems.map(item => [item.path, item]))
  const treeByPath = new Map<string, AudioFileItem>()
  for (const item of treeItems) {
    treeByPath.set(item.path ?? `${dir.path}/${item.name}`, item)
  }

  const emitted = new Set<string>()
  /** 三路结果按真实路径去重，谁先到用谁的文件信息，元数据逐路叠加 */

  // 1. 目录直读：分区存储下公共目录通常列不出来（readDir 直接失败），
  //    但「有所有文件访问权限」/ 老系统 / 下载完还没被索引时，只有它能列出新文件。
  //    只做 best-effort：拿不到不报错，继续用 SAF / MediaStore。
  const walked: DirEntry[] = []
  await walk(dir.path, 0, walked)
  for (const file of walked) {
    if (emitted.has(file.path)) continue
    emitted.add(file.path)
    const ms = msByPath.get(file.path)
    const tree = treeByPath.get(file.path)
    out.push({
      ...file,
      mtime: file.mtime ?? ms?.mtime,
      // 有系统索引 / SAF 条目才带 meta；两者都没有时不要建空 meta ——
      // buildMusicInfo 看到 meta 存在就不会再走 readMetadata 读内嵌标签了，
      // 而「刚下载、系统还没索引」的文件正好只有这条路能拿到歌手 / 专辑 / 封面
      meta: (ms != null || tree != null)
        ? {
            title: ms?.title,
            artist: ms?.artist,
            album: ms?.album,
            duration: ms?.duration,
            picUrl: ms?.albumArt,
            // SAF 文档 uri 是公共目录唯一稳定的播放 / 读标签地址
            contentUri: tree?.uri ?? ms?.contentUri,
          }
        : undefined,
    })
    onProgress?.(out.length)
  }

  // 2. SAF 枚举：用户授权过的目录树一定能列全（包括系统没索引的文件）
  for (const item of treeItems) {
    const path = item.path ?? `${dir.path}/${item.name}`
    if (emitted.has(path)) continue
    const ms = msByPath.get(path)
    emitted.add(path)
    out.push({
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
        contentUri: item.uri ?? ms?.contentUri,
      },
    })
    onProgress?.(out.length)
  }

  // 3. MediaStore 兜底：系统索引里有、但目录列不出来 / 没 SAF 授权的文件
  for (const item of msItems) {
    if (emitted.has(item.path)) continue
    emitted.add(item.path)
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
  /*
    增量扫描（D-03）：上一次的曲库本身就是「路径 + mtime + size」快照，
    路径、大小、修改时间都没变的文件直接复用旧条目，不再读标签/抽封面。
    删除的文件通过差集得到；新增/变更才走 buildMusicInfo。
  */
  const scanStartedAt = Date.now()
  const previous = await getLocalMusicList().catch(() => [])
  const previousByPath = new Map(previous.map(item => [item.meta.filePath, item]))
  let added = 0
  let updated = 0
  let unchanged = 0
  let failed = 0
  for (const file of files) {
    if (seen.has(file.path)) continue
    seen.add(file.path)
    const prev = previousByPath.get(file.path)
    const canReuse = canReuseScannedFile(prev, file)
    if (canReuse && prev) {
      list.push(prev)
      unchanged += 1
    } else {
      try {
        list.push(await buildMusicInfo(file))
        if (prev) updated += 1
        else added += 1
      } catch (err) {
        failed += 1
        log.error(err)
      }
    }
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

  // 合并「刚下载、这次还没扫到」的条目（见 PENDING_KEY 注释）：
  // 文件确实还在才保留，删掉的歌不会被复活；扫到了的从暂存里移除。
  try {
    const pending = await getPendingAdded()
    if (pending.length) {
      const scannedPaths = new Set(list.map(item => item.meta.filePath))
      const remain: LX.Music.MusicInfoLocal[] = []
      let appended = false
      for (const item of pending) {
        const filePath = item.meta.filePath
        if (!filePath || scannedPaths.has(filePath)) continue
        if (filePath.startsWith('content://')) {
          // content:// 文档 uri 没法用 existsFile 判断，只能靠扫描 SAF 目录确认；
          // 超过 7 天还没被扫到就放弃，避免删掉的文件变成永远清不掉的僵尸条目
          if (item.meta.mtime && Date.now() - item.meta.mtime > PENDING_TTL) continue
          scannedPaths.add(filePath)
          list.push(item)
          remain.push(item)
          appended = true
          continue
        }
        if (await existsFile(filePath).catch(() => false)) {
          scannedPaths.add(filePath)
          list.push(item)
          remain.push(item)
          appended = true
        }
      }
      if (appended) list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
      await savePendingAdded(remain)
    }
  } catch (err) {
    // 暂存区读写失败不能影响扫描结果本身
    log.error(err)
  }

  // 差集得到被删除/失权的文件；pending 里保留下来的条目也算进最终列表，不能误报删除
  const finalPaths = new Set(list.map(item => item.meta.filePath))
  const removed = previous.reduce((count, item) => finalPaths.has(item.meta.filePath) ? count : count + 1, 0)
  const report: ScanReport = {
    finishedAt: Date.now(),
    durationMs: Date.now() - scanStartedAt,
    total: list.length,
    added,
    updated,
    unchanged,
    removed,
    failed,
    needAuth: needAuth.map(dir => dir.path),
  }
  try {
    await saveData(SCAN_REPORT_KEY, report)
  } catch {}

  // 只有完整扫完才替换内存缓存并持久化：
  // 中途失败 / 被中断时 cachedList 和磁盘上都还是上一次的完整列表，
  // 不会被半截数据覆盖（用户不会「扫一半发现歌少了一半」）
  cachedList = [...list]
  try {
    await saveLocalMusicList(list)
  } finally {
    // 即使持久化失败（磁盘满等），也要把内存里的完整结果通知出去，
    // 否则界面会一直停在扫描中的半成品上
    emitLocalMusicUpdated(list)
  }
  return { list, dir: dirs[0]?.path ?? '', dirs, needAuth, report }
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
  await saveLocalMusicList(newList)
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
  await saveLocalMusicList(list)
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
  /** 下载时已知的封面地址（搜索结果自带的 img），优先于联网搜索 */
  picUrl?: string
}) => {
  if (!item.filePath) return
  // 下载完成后用户可能立刻删任务/删文件，别把不存在的文件收进曲库
  if (!item.filePath.startsWith('content://') && !await existsFile(item.filePath).catch(() => false)) {
    log.warn(`add local music skipped, file not exists: ${item.filePath}`)
    return
  }
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
  await saveLocalMusicList(next)
  emitLocalMusicUpdated(next)

  // 记进「待扫描确认」列表：系统索引有延迟时，下一次整库扫描不会把这条覆盖掉
  try {
    const pending = await getPendingAdded()
    if (!pending.some(m => m.meta.filePath === info.meta.filePath)) {
      await savePendingAdded([...pending, info])
    }
  } catch (err) {
    log.error(err)
  }

  // 封面：内嵌封面 → 下载时拿到的网络封面（落成本地文件）→ 联网搜索。
  // 下载时写封面可能失败，所以这里必须再兜一层，保证曲库条目有可显示的封面。
  try {
    const pic = await resolveDownloadedCover(info, item.picUrl)
    if (pic) await updateLocalMusicPic(info.meta.filePath, pic)
  } catch (err) {
    // 补封面失败不能影响入库结果
    log.error(err)
  }
}

/**
 * 文件被重命名 / 移动后，同步更新曲库条目。
 *
 * 曲库条目的 id 由 filePath 派生（`local_${filePath}`），所以路径变了 id 必须一起换，
 * 否则页面 key、播放列表引用都会指向旧路径。这里只改曲库记录，不动文件本身 ——
 * 文件操由调用方（音乐工具的批量重命名）完成。
 */
export const updateLocalMusicFilePath = async(oldPath: string, newPath: string): Promise<void> => {
  if (!oldPath || !newPath || oldPath === newPath) return
  const list = await getLocalMusicList()
  const index = list.findIndex(m => m.meta.filePath === oldPath)
  if (index < 0) return
  const item = list[index]
  const updated: LX.Music.MusicInfoLocal = {
    ...item,
    id: `local_${newPath}`,
    meta: {
      ...item.meta,
      filePath: newPath,
      songId: newPath,
      ext: extname(newPath),
    },
  }
  // 整条替换成新对象：页面里行的 memo 靠引用变化决定要不要重渲染
  list[index] = updated
  cachedList = list
  await saveLocalMusicList(list)
  emitLocalMusicUpdated(list)
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
  await saveLocalMusicList(list)
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

/** 读取最近一次扫描报告（没有扫过返回 null） */
export const getLastScanReport = async(): Promise<ScanReport | null> => {
  try {
    return await getData<ScanReport>(SCAN_REPORT_KEY) ?? null
  } catch {
    return null
  }
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
