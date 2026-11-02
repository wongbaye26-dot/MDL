import { DeviceEventEmitter, NativeModules, type EmitterSubscription } from 'react-native'

export interface PickedDirectory {
  path: string
  name: string
  /** SAF 的 tree uri，后续用它枚举目录内容（拿不到就没法扫） */
  treeUri?: string
}

export interface AudioFileItem {
  path: string
  /** 文件名（含扩展名） */
  name: string
  size: number
  /** 毫秒 */
  mtime: number
  /** SAF 文档 uri（content://com.android.externalstorage.documents/...），可直接交给播放器 */
  uri?: string
  /** 系统索引里的标题/歌手/专辑/时长(ms)，可能为空串 */
  title?: string
  artist?: string
  album?: string
  duration?: number
  /** MediaStore 里的 id */
  id?: number
  albumId?: number
  /** content://media/external/audio/media/<id> */
  contentUri?: string
  /** content://media/external/audio/albumart/<albumId> */
  albumArt?: string
}

export interface AudioMeta {
  duration?: number
  bitrate?: number
  sampleRate?: number
  /** 文件内标签（SAF 枚举出来的文件没有系统索引，只能读这里） */
  title?: string
  artist?: string
  album?: string
  /** 内嵌封面被写到缓存目录后的本地路径 */
  cover?: string
}

interface DirectoryPickerModule {
  pick: () => Promise<boolean>
  listAudio?: (prefix: string) => Promise<AudioFileItem[]>
  listTree?: (treeUri: string) => Promise<AudioFileItem[]>
  canWriteTree?: (treeUri: string) => Promise<boolean>
  hasTreePermission?: (treeUri: string) => Promise<boolean>
  writeSiblingText?: (docUri: string, fileName: string, content: string) => Promise<string>
  copyToTree?: (treeUri: string, fileName: string, srcPath: string) => Promise<string>
  readAudioMeta?: (contentUri: string) => Promise<AudioMeta>
  findAudioByPath?: (path: string) => Promise<{ contentUri?: string, albumArt?: string } | null>
}

interface PickedPayload {
  path?: string
  name?: string
  treeUri?: string
  error?: string
}

const nativeModule = NativeModules.DirectoryPicker as DirectoryPickerModule | undefined

/** 当前安装包是否带目录选择器（老版本/其它平台没有） */
export const isDirectoryPickerSupported = !!nativeModule?.pick

let subscription: EmitterSubscription | null = null
let pending: { resolve: (v: PickedDirectory | null) => void, reject: (e: Error) => void } | null = null

const ensureListener = () => {
  if (subscription) return
  // 结果由原生透明 Activity 通过事件回传（RNN 不转发 onActivityResult）
  subscription = DeviceEventEmitter.addListener('DirectoryPicked', (payload: PickedPayload) => {
    const current = pending
    pending = null
    if (!current) return
    if (payload?.error) {
      current.reject(new Error(payload.error))
      return
    }
    if (!payload?.path) {
      current.resolve(null)
      return
    }
    current.resolve({ path: payload.path, name: payload.name ?? payload.path, treeUri: payload.treeUri })
  })
}

/**
 * 用 MediaStore 查某个目录下的音频文件。
 *
 * 分区存储下普通目录不能 listFiles()，只能走系统索引；拿到的路径可以直接读
 * （需要 READ_MEDIA_AUDIO）。
 */
export const listAudioFiles = async(prefix: string): Promise<AudioFileItem[]> => {
  if (!nativeModule?.listAudio) return []
  return nativeModule.listAudio(prefix)
}

/**
 * 用 SAF 枚举某个目录树（含子目录）里的音频文件。
 *
 * 这是「添加文件夹后扫不出来」的根治方案：
 * MediaStore 只索引系统认可的媒体，用户自己拷进来的目录经常一条都没有；
 * 而 SAF 是用户亲手授权过的目录，能直接列，不依赖系统索引。
 * 返回项的 uri 是文档 uri，可以直接交给播放器 / 元数据解析器。
 */
export const listTreeAudio = async(treeUri: string): Promise<AudioFileItem[]> => {
  if (!nativeModule?.listTree) return []
  try {
    return await nativeModule.listTree(treeUri)
  } catch {
    return []
  }
}

/** 读采样率 / 码率 / 时长（通过 content:// uri，公共目录也能读） */
export const readAudioMeta = async(contentUri: string): Promise<AudioMeta | null> => {
  if (!nativeModule?.readAudioMeta) return null
  try {
    return await nativeModule.readAudioMeta(contentUri)
  } catch {
    return null
  }
}

/** 按文件路径反查 MediaStore 的 content:// 地址（老数据兜底） */
export const findAudioByPath = async(path: string): Promise<{ contentUri?: string, albumArt?: string } | null> => {
  if (!nativeModule?.findAudioByPath) return null
  try {
    return await nativeModule.findAudioByPath(path)
  } catch {
    return null
  }
}

/**
 * 检查某个 SAF 目录树的读授权是否还有效。
 * 用户清存储 / 重装 / 手动撤销授权后都会失效，此时枚举目录只会得到空结果。
 */
export const hasTreePermission = async(treeUri: string): Promise<boolean> => {
  if (!nativeModule?.hasTreePermission) return true
  try {
    return await nativeModule.hasTreePermission(treeUri)
  } catch {
    return true
  }
}

/**
 * 探测 SAF 目录是否可写（原生会真建一个探针文件再删掉）。
 * 公共目录在 Android 11+ 一律不可写，只有这种授权目录能写。
 */
export const canWriteTree = async(treeUri: string): Promise<boolean> => {
  if (!nativeModule?.canWriteTree) return false
  try {
    return await nativeModule.canWriteTree(treeUri)
  } catch {
    return false
  }
}

/**
 * 把本地文件复制进 SAF 目录（同名覆盖）。
 * react-native-fs 的 copyFile 不认 content://，只能走原生。
 * @returns 复制后的文档 uri
 */
export const copyFileToTree = async(treeUri: string, fileName: string, srcPath: string): Promise<string | null> => {
  if (!nativeModule?.copyToTree) return null
  try {
    return await nativeModule.copyToTree(treeUri, fileName, srcPath)
  } catch {
    return null
  }
}

/**
 * 在某个已下载的文档旁边写一个同目录的文本文件（用来写 .lrc）。
 *
 * 不能对 content:// 文档 uri 直接做字符串替换来换扩展名 —— 那会生成
 * URL 编码的垃圾文件名，所以交给原生按「父目录 + 文件名」重建。
 */
export const writeTextToSibling = async(docUri: string, fileName: string, content: string): Promise<string | null> => {
  if (!nativeModule?.writeSiblingText) return null
  try {
    return await nativeModule.writeSiblingText(docUri, fileName, content)
  } catch {
    return null
  }
}

/** 把 content:// 的 tree uri 还原成给人看的路径，识别不了就原样返回 */
export const treeUriToDisplayPath = (treeUri: string): string => {
  try {
    const decoded = decodeURIComponent(treeUri)
    const marker = '/tree/'
    const idx = decoded.indexOf(marker)
    if (idx < 0) return treeUri
    const docId = decoded.slice(idx + marker.length).replace(/\/document\/.*$/, '')
    const colon = docId.indexOf(':')
    if (colon < 0) return treeUri
    const volume = docId.slice(0, colon)
    const relative = docId.slice(colon + 1)
    const root = /^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$/.test(volume) ? `/storage/${volume}` : '/storage/emulated/0'
    return relative ? `${root}/${relative}` : root
  } catch {
    return treeUri
  }
}

/**
 * 打开系统目录选择器（SAF）。
 * 用户取消时 resolve(null)；目录解析不出本机路径时 reject。
 */
export const pickDirectory = async(): Promise<PickedDirectory | null> => {
  if (!nativeModule?.pick) throw new Error('当前版本不支持选择目录')
  ensureListener()
  return new Promise<PickedDirectory | null>((resolve, reject) => {
    if (pending) {
      reject(new Error('已经有一个选择器在打开了'))
      return
    }
    pending = { resolve, reject }
    nativeModule.pick().catch((e: unknown) => {
      pending = null
      reject(e instanceof Error ? e : new Error(String(e)))
    })
  })
}
