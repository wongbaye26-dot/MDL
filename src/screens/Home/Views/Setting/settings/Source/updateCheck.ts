import { httpFetch } from '@/utils/request'
import { compareVer } from '@/utils'
import { matchInfo, updateUserApiInfo } from '@/utils/data'
import { log } from '@/utils/log'
import { notifySourcePageState, sourcePageState, type UpdateCheckInfo } from './state'

/** 判断脚本信息里是否存在可比较的数字版本号 */
const hasVersion = (version: string | undefined): version is string => !!version && /\d/.test(version)

/**
 * 检查某个自定义源是否有新版本：
 * 重新拉取导入时记录的在线脚本地址，解析脚本头注释里的 @version，
 * 和本地保存的版本号用 compareVer 比较。
 *
 * 结果保存在页面级状态 sourcePageState.updateChecks 里，同时把检查时间持久化到源信息上。
 */
export const checkUserApiUpdate = async(api: LX.UserApi.UserApiInfo): Promise<UpdateCheckInfo> => {
  const importUrl = api.importUrl
  if (!importUrl || !/^https?:\/\//.test(importUrl)) {
    const result: UpdateCheckInfo = { status: 'unavailable', checkedAt: Date.now() }
    sourcePageState.updateChecks[api.id] = result
    notifySourcePageState()
    return result
  }

  sourcePageState.updateChecks[api.id] = { status: 'checking', checkedAt: Date.now() }
  notifySourcePageState()

  let result: UpdateCheckInfo
  try {
    const resp = await httpFetch(importUrl, { timeout: 20_000 }).promise
    const script = typeof resp.body === 'string' ? resp.body : ''
    if (!script) throw new Error('empty script')
    const header = /^\/\*[\S|\s]+?\*\//.exec(script)?.[0] ?? script
    const scriptInfo = matchInfo(header)
    if (!hasVersion(scriptInfo.version)) throw new Error('version not found')
    result = compareVer(scriptInfo.version, api.version || '0') > 0
      ? { status: 'new', latestVersion: scriptInfo.version, checkedAt: Date.now() }
      : { status: 'latest', latestVersion: scriptInfo.version, checkedAt: Date.now() }
  } catch (err: any) {
    log.error('[sourceUpdate] check failed:', api.name, err?.message ?? err)
    result = { status: 'failed', checkedAt: Date.now(), error: err?.message ?? 'network error' }
  }

  sourcePageState.updateChecks[api.id] = result
  notifySourcePageState()
  void updateUserApiInfo(api.id, { lastCheckAt: result.checkedAt })
  return result
}
