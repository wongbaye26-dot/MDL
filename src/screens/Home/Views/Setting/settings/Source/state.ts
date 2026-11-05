import { useEffect, useState } from 'react'

import type { SourceCheckResult } from '@/core/sourceCheck'

/**
 * 「音源管理」页面内的运行时状态（只保存在内存里，退出页面不丢、重启 App 会重置）：
 * - 上次实测检测的时间 / 关键词 / 结果，用于页面顶部汇总和回到页面时恢复结果；
 * - 每个自定义源的在线更新检查结果，避免来回切换分组时重复请求。
 */
export type UpdateCheckStatus = 'checking' | 'new' | 'latest' | 'unavailable' | 'failed'

export interface UpdateCheckInfo {
  status: UpdateCheckStatus
  latestVersion?: string
  checkedAt: number
  error?: string
}

export interface SourcePageState {
  lastCheckAt: number
  lastCheckKeyword: string
  lastCheckResults: SourceCheckResult[]
  updateChecks: Record<string, UpdateCheckInfo>
}

export const sourcePageState: SourcePageState = {
  lastCheckAt: 0,
  lastCheckKeyword: '',
  lastCheckResults: [],
  updateChecks: {},
}

const listeners = new Set<() => void>()

export const notifySourcePageState = () => {
  for (const listener of listeners) listener()
}

/**
 * 订阅页面级状态变化；任何组件写入 sourcePageState 后调用 notifySourcePageState()
 */
export const useSourcePageState = (): SourcePageState => {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const listener = () => { forceUpdate(value => value + 1) }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return sourcePageState
}

/**
 * 订阅当前脚本的音质矩阵（global.lx.qualityList）。
 * 初始化成功 / 切换音源后由 apiSourceUpdated 事件刷新。
 */
export const useQualityList = (): LX.QualityList => {
  const [qualityList, setQualityList] = useState<LX.QualityList>(global.lx.qualityList)
  useEffect(() => {
    const handleUpdate = () => { setQualityList({ ...global.lx.qualityList }) }
    global.state_event.on('apiSourceUpdated', handleUpdate)
    return () => { global.state_event.off('apiSourceUpdated', handleUpdate) }
  }, [])
  return qualityList
}
