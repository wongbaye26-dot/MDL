import { DeviceEventEmitter, NativeModules, type EmitterSubscription } from 'react-native'

export interface PickedDirectory {
  path: string
  name: string
}

export interface AudioFileItem {
  path: string
  /** 文件名（含扩展名） */
  name: string
  size: number
  /** 毫秒 */
  mtime: number
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
  /** 内嵌封面被写到缓存目录后的本地路径 */
  cover?: string
}

interface DirectoryPickerModule {
  pick: () => Promise<boolean>
  listAudio?: (prefix: string) => Promise<AudioFileItem[]>
  readAudioMeta?: (contentUri: string) => Promise<AudioMeta>
}

interface PickedPayload {
  path?: string
  name?: string
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
    current.resolve({ path: payload.path, name: payload.name ?? payload.path })
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

/** 读采样率 / 码率 / 时长（通过 content:// uri，公共目录也能读） */
export const readAudioMeta = async(contentUri: string): Promise<AudioMeta | null> => {
  if (!nativeModule?.readAudioMeta) return null
  try {
    return await nativeModule.readAudioMeta(contentUri)
  } catch {
    return null
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
