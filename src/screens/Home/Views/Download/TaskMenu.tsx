import { forwardRef, useImperativeHandle, useState } from 'react'

import ActionSheet, { type ActionSheetAction, type ActionSheetItem } from '@/components/common/ActionSheet'
import type { Position } from '@/components/common/Menu'
import PicImage from '@/components/common/PicImage'
import { QUALITY_LABEL } from '@/core/download/utils'

/**
 * 下载任务的「更多菜单」：共用底部 ActionSheet（Material You 配色）。
 *
 * 只换菜单 UI / 主题色，原有 action 集合全部保留：
 *   快捷卡 → 按任务状态给主操作：播放 / 重新下载 / 加入收藏（已完成）
 *            暂停下载（下载中）/ 重新下载（失败）/ 开始下载（等待、已暂停）
 *   操作行 → 从列表移除（保留文件）/ 删除任务和文件（危险，红色）
 */
export type TaskMenuAction = 'start' | 'pause' | 'retry' | 'remove' | 'removeWithFile' | 'play' | 'collect'

export interface TaskMenuType {
  show: (task: LX.Download.ListItem, position: Position) => void
}

export interface TaskMenuProps {
  onAction: (action: TaskMenuAction, task: LX.Download.ListItem) => void
}

export default forwardRef<TaskMenuType, TaskMenuProps>(({ onAction }, ref) => {
  /** 当前任务：关闭后保留，退场动画期间 header 不会变空 */
  const [task, setTask] = useState<LX.Download.ListItem | null>(null)
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    // 旧 API 的 position 参数保留只为兼容调用方，底部 Sheet 不再需要定位
    show(info: LX.Download.ListItem, _position: Position) {
      setTask(info)
      setVisible(true)
    },
  }))

  if (!task) return null

  const musicInfo = task.metadata.musicInfo
  const quality = QUALITY_LABEL[task.metadata.quality] ?? task.metadata.quality
  const close = () => { setVisible(false) }
  const runAction = (action: TaskMenuAction) => {
    close()
    onAction(action, task)
  }

  const actions: ActionSheetAction[] = []
  if (task.isComplate) {
    actions.push({ key: 'play', label: '播放', icon: 'play', onPress: () => { runAction('play') } })
    actions.push({ key: 'retry', label: '重新下载', icon: 'refresh', onPress: () => { runAction('retry') } })
    actions.push({ key: 'collect', label: '加入收藏', icon: 'heart-outline', onPress: () => { runAction('collect') } })
  } else if (task.status === 'run') {
    actions.push({ key: 'pause', label: '暂停下载', icon: 'pause', onPress: () => { runAction('pause') } })
  } else if (task.status === 'error') {
    actions.push({ key: 'retry', label: '重新下载', icon: 'refresh', onPress: () => { runAction('retry') } })
  } else {
    actions.push({ key: 'start', label: '开始下载', icon: 'play', onPress: () => { runAction('start') } })
  }

  const items: ActionSheetItem[] = [
    {
      key: 'remove',
      label: '从列表移除（保留文件）',
      icon: 'close-circle-outline',
      onPress: () => { runAction('remove') },
    },
    {
      key: 'removeWithFile',
      label: '删除任务和文件',
      icon: 'trash-can-outline',
      danger: true,
      onPress: () => { runAction('removeWithFile') },
    },
  ]

  return (
    <ActionSheet
      visible={visible}
      header={{
        cover: <PicImage musicInfo={task} style={{ width: 56, height: 56, borderRadius: 12 }} />,
        title: musicInfo.name || '未知歌曲',
        subtitle: `${musicInfo.singer || '未知歌手'} · ${quality}`,
      }}
      actions={actions}
      items={items}
      onClose={close}
    />
  )
})
