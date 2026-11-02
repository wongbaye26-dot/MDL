import { NativeEventEmitter, NativeModules } from 'react-native'
import { log } from '@/utils/log'

const { UserApiModule } = NativeModules

let loadScriptInfo: LX.UserApi.UserApiInfo | null = null
export const loadScript = (info: LX.UserApi.UserApiInfo & { script: string }) => {
  loadScriptInfo = info
  UserApiModule.loadScript({
    id: info.id,
    name: info.name,
    description: info.description,
    version: info.version ?? '',
    author: info.author ?? '',
    homepage: info.homepage ?? '',
    script: info.script,
  })
}

export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: {
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}
export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T]) => {
  UserApiModule.sendAction(action, JSON.stringify(data))
}

// export const clearAppCache = CacheModule.clearAppCache as () => Promise<void>

export interface InitParams {
  status: boolean
  errorMessage: string
  info: LX.UserApi.UserApiInfo
}

export interface ResponseParams {
  status: boolean
  errorMessage?: string
  requestKey: string
  result: any
}
export interface UpdateInfoParams {
  name: string
  log: string
  updateUrl: string
}
export interface RequestParams {
  requestKey: string
  url: string
  options: {
    method: string
    data: any
    timeout: number
    headers: any
    binary: boolean
  }
}
export type CancelRequestParams = string

export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { action: K, data: Actions[K] } }[keyof Actions]

export const onScriptAction = (handler: (event: ActionsEvent) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UserApiModule)
  const eventListener = eventEmitter.addListener('api-action', event => {
    // log 事件的 data 是脚本里 console.log 的原文，不是 JSON ——
    // 直接 parse 会抛 "Unexpected character"，被全局错误处理弹成「应用出 bug 了」。
    // 其余 action 才是 JSON；解析失败就把这条事件丢掉（不能塞 null，
    // 下游是直接读 event.data.requestKey 的，会再崩一次）。
    if (event.data && event.action !== 'log') {
      try {
        event.data = JSON.parse(event.data as string)
      } catch (err) {
        log.error('userApi action parse failed:', event.action, err)
        return
      }
    }
    if (event.action == 'init') {
      const data = event.data ?? {}
      data.info = data.info ? { ...loadScriptInfo, ...data.info } : { ...loadScriptInfo }
      event.data = data
    } else if (event.action == 'showUpdateAlert') {
      if (!loadScriptInfo?.allowShowUpdateAlert) return
    }
    // 单个事件处理失败不能把整个应用打崩（会弹全局错误框，还挡住界面）
    try {
      handler(event as ActionsEvent)
    } catch (err) {
      log.error('userApi action handle failed:', event.action, err)
    }
  })

  return () => {
    eventListener.remove()
  }
}

export const destroy = () => {
  UserApiModule.destroy()
}
