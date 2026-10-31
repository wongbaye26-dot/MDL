import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import Menu, { type Menus, type MenuType, type Position } from '@/components/common/Menu'

export type TaskMenuAction = 'start' | 'pause' | 'retry' | 'remove' | 'removeWithFile'

export interface TaskMenuType {
  show: (task: LX.Download.ListItem, position: Position) => void
}

export interface TaskMenuProps {
  onAction: (action: TaskMenuAction, task: LX.Download.ListItem) => void
}

export default forwardRef<TaskMenuType, TaskMenuProps>(({ onAction }, ref) => {
  const menuRef = useRef<MenuType>(null)
  const taskRef = useRef<LX.Download.ListItem | null>(null)
  const [visible, setVisible] = useState(false)
  const [menus, setMenus] = useState<Menus>([])

  useImperativeHandle(ref, () => ({
    show(task, position) {
      taskRef.current = task
      setMenus(buildMenus(task))
      if (visible) {
        menuRef.current?.show(position)
      } else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show(position)
        })
      }
    },
  }))

  const handlePress = (menu: Menus[number]) => {
    const task = taskRef.current
    if (!task) return
    menuRef.current?.hide()
    onAction(menu.action as TaskMenuAction, task)
  }

  return visible
    ? <Menu ref={menuRef} menus={menus} onPress={handlePress} />
    : null
})

const buildMenus = (task: LX.Download.ListItem): Menus => {
  const menus: Array<{ action: string, label: string, disabled?: boolean }> = []
  if (!task.isComplate) {
    if (task.status === 'run') {
      menus.push({ action: 'pause', label: '暂停下载' })
    } else if (task.status === 'error') {
      menus.push({ action: 'retry', label: '重新下载' })
    } else {
      menus.push({ action: 'start', label: '开始下载' })
    }
  } else {
    menus.push({ action: 'retry', label: '重新下载' })
  }
  menus.push({ action: 'remove', label: '从列表移除（保留文件）' })
  menus.push({ action: 'removeWithFile', label: '删除任务和文件' })
  return menus
}
