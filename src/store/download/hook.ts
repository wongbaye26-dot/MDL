import { useEffect, useState } from 'react'
import { state } from './state'
import { event } from './event'

export const useDownloadList = () => {
  const [value, update] = useState(state.list)

  useEffect(() => {
    const handleListUpdate = (list: LX.Download.ListItem[]) => {
      update(list)
    }
    // 进度/状态变化只发 task_changed，必须同步到列表，否则卡片会一直停在旧状态
    // （典型表现：还在下载却显示「已完成」、进度条不动）
    const handleTaskUpdate = (task: LX.Download.ListItem) => {
      update(prev => {
        const index = prev.findIndex(item => item.id === task.id)
        if (index < 0) return prev
        if (prev[index] === task) return prev
        const next = prev.slice()
        next[index] = task
        return next
      })
    }
    event.on('list_changed', handleListUpdate)
    event.on('task_changed', handleTaskUpdate)
    return () => {
      event.off('list_changed', handleListUpdate)
      event.off('task_changed', handleTaskUpdate)
    }
  }, [])

  return value
}

export const useDownloadTask = (id: string) => {
  const [value, update] = useState(() => state.list.find(task => task.id === id))

  useEffect(() => {
    const handleUpdate = (task: LX.Download.ListItem) => {
      if (task.id !== id) return
      update(task)
    }
    const handleListUpdate = (list: LX.Download.ListItem[]) => {
      update(list.find(task => task.id === id))
    }
    event.on('task_changed', handleUpdate)
    event.on('list_changed', handleListUpdate)
    return () => {
      event.off('task_changed', handleUpdate)
      event.off('list_changed', handleListUpdate)
    }
  }, [id])

  return value
}

export interface DownloadStats {
  total: number
  running: number
  waiting: number
  completed: number
  error: number
}

const getStats = (): DownloadStats => {
  const stats: DownloadStats = { total: 0, running: 0, waiting: 0, completed: 0, error: 0 }
  for (const task of state.list) {
    stats.total++
    if (task.isComplate || task.status === 'completed') stats.completed++
    else if (task.status === 'run') stats.running++
    else if (task.status === 'error') stats.error++
    else stats.waiting++
  }
  return stats
}

export const useDownloadStats = () => {
  const [value, update] = useState(getStats)

  useEffect(() => {
    const handler = () => {
      update(getStats())
    }
    event.on('status_changed', handler)
    return () => {
      event.off('status_changed', handler)
    }
  }, [])

  return value
}
