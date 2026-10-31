import { state } from './state'
import { event } from './event'

export interface TaskPatch extends Partial<Omit<LX.Download.ListItem, 'metadata'>> {
  metadata?: Partial<LX.Download.ListItem['metadata']>
}

export const getTaskById = (id: string) => state.list.find(task => task.id === id)

export const setList = (list: LX.Download.ListItem[]) => {
  state.list = list
  event.list_changed([...list])
  event.status_changed()
}

export const addTasks = (tasks: LX.Download.ListItem[]) => {
  if (!tasks.length) return
  state.list.push(...tasks)
  event.list_changed([...state.list])
  event.status_changed()
}

export const updateTask = (id: string, patch: TaskPatch) => {
  const index = state.list.findIndex(task => task.id === id)
  if (index < 0) return
  const task = state.list[index]
  const next: LX.Download.ListItem = {
    ...task,
    ...patch,
    metadata: patch.metadata ? { ...task.metadata, ...patch.metadata } : task.metadata,
  }
  state.list.splice(index, 1, next)
  event.task_changed(next)
  if (patch.status != null || patch.isComplate != null) event.status_changed()
}

export const removeTasks = (ids: string[]) => {
  if (!ids.length) return
  const idSet = new Set(ids)
  state.list = state.list.filter(task => !idSet.has(task.id))
  event.list_changed([...state.list])
  event.status_changed()
}

export const clearCompleted = () => {
  state.list = state.list.filter(task => !task.isComplate)
  event.list_changed([...state.list])
  event.status_changed()
}

export const setInit = () => {
  state.isInit = true
}

export const isInit = () => state.isInit
