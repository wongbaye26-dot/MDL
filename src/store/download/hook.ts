import { useEffect, useState } from 'react'
import { state } from './state'
import { event } from './event'

export const useDownloadList = () => {
  const [value, update] = useState(state.list)

  useEffect(() => {
    event.on('list_changed', update)
    return () => {
      event.off('list_changed', update)
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
