import { NativeEventEmitter, NativeModules, type NativeModule } from 'react-native'

const { DownloadModule } = NativeModules as {
  DownloadModule?: {
    startTask: (opts: StartTaskOptions) => void
    pauseTask: (id: string) => void
    removeTask: (id: string) => void
    pauseAll: () => void
    getTaskInfo: (id: string, path: string) => Promise<{ id: string, downloaded: number, isCompleted: boolean }>
    isTaskRunning: (id: string) => Promise<boolean>
    /** 把普通路径的文件交给系统媒体库索引（老版本原生包没有这个方法） */
    scanFile?: (path: string) => Promise<boolean>
    destroy: () => void
  }
}

export interface StartTaskOptions {
  id: string
  url: string
  path: string
  headers?: Record<string, string>
}

export interface ProgressPayload {
  id: string
  downloaded: number
  total: number
  speed: number
}

export type DownloadEventPayload = {
  action: 'start'
  id: string
  downloaded: number
  total: number
} | {
  action: 'progress'
  id: string
  downloaded: number
  total: number
  speed: number
} | {
  action: 'pause'
  id: string
  downloaded: number
  total: number
} | {
  action: 'complete'
  id: string
  total: number
} | {
  action: 'error'
  id: string
  code: number
  message: string
  downloaded: number
}

const EVENT_NAME = 'download-event'

export const isSupported = () => DownloadModule != null

const assertSupported = () => {
  if (!DownloadModule) throw new Error('当前设备不支持下载（DownloadModule 未注册）')
  return DownloadModule
}

export const startTask = (opts: StartTaskOptions) => {
  assertSupported().startTask(opts)
}

export const pauseTask = (id: string) => {
  assertSupported().pauseTask(id)
}

export const removeTask = (id: string) => {
  assertSupported().removeTask(id)
}

export const pauseAll = () => {
  assertSupported().pauseAll()
}

export const getTaskInfo = async(id: string, path: string) => {
  return assertSupported().getTaskInfo(id, path)
}

export const isTaskRunning = async(id: string) => {
  return assertSupported().isTaskRunning(id)
}

/**
 * 把普通路径的文件交给系统媒体库（MediaScannerConnection）索引。
 *
 * 下载任务本身完成时原生已经扫过一次；这里给「SAF 目录复制完成」这条路径补扫，
 * 否则复制到公共目录的文件在 MediaStore 里没有记录，重新扫描本地音乐时就找不到。
 * 老版本原生包没有 scanFile 时静默跳过（返回 false）。
 */
export const scanFile = async(path: string): Promise<boolean> => {
  if (!DownloadModule?.scanFile || !path) return false
  try {
    return await DownloadModule.scanFile(path)
  } catch {
    return false
  }
}

export const destroy = () => {
  DownloadModule?.destroy()
}

export const onDownloadEvent = (handler: (event: DownloadEventPayload) => void): () => void => {
  if (!DownloadModule) return () => {}
  const eventEmitter = new NativeEventEmitter(DownloadModule as unknown as NativeModule)
  const listener = eventEmitter.addListener(EVENT_NAME, handler)
  return () => {
    listener.remove()
  }
}
