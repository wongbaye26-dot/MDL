import { NativeEventEmitter, NativeModules } from 'react-native'

const { DownloadModule } = NativeModules as {
  DownloadModule?: {
    startTask: (opts: StartTaskOptions) => void
    pauseTask: (id: string) => void
    removeTask: (id: string) => void
    pauseAll: () => void
    getTaskInfo: (id: string, path: string) => Promise<{ id: string, downloaded: number, isCompleted: boolean }>
    isTaskRunning: (id: string) => Promise<boolean>
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

export const destroy = () => {
  DownloadModule?.destroy()
}

export const onDownloadEvent = (handler: (event: DownloadEventPayload) => void): () => void => {
  if (!DownloadModule) return () => {}
  const eventEmitter = new NativeEventEmitter(DownloadModule as any)
  const listener = eventEmitter.addListener(EVENT_NAME, handler)
  return () => {
    listener.remove()
  }
}
