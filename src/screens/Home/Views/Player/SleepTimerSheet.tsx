import { memo, useMemo } from 'react'

import ActionSheet, { type ActionSheetItem } from '@/components/common/ActionSheet'
import {
  cancelSleepTimer,
  startSleepTimer,
  startSleepTimerAtTrackEnd,
  useSleepTimerInfo,
} from '@/core/player/sleepTimer'
import { formatPlayTime2 } from '@/utils/common'

/**
 * 播放器「定时关闭」面板。
 *
 * 用全站统一的 ActionSheet，而不是再写一套弹窗：
 * - 顶部快捷卡：15 / 30 / 45 / 60 / 90 分钟；
 * - 下方操作行：播完当前曲、取消定时（未开启时不显示）；
 * - header 实时显示剩余时间。
 */
/** 顶部快捷卡只放 3 个，塞 5 个会把「15分」压成「1…」 */
const QUICK_MINUTES = [15, 30, 60]
/** 其余时长放操作行（整行宽度，不会截断） */
const MORE_MINUTES = [45, 90]

export default memo(({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const info = useSleepTimerInfo()

  const subtitle = useMemo(() => {
    if (info.mode === 'duration') return `将在 ${formatPlayTime2(info.remaining)} 后暂停播放`
    if (info.mode === 'endOfTrack') return `播完当前歌曲后暂停（约剩 ${formatPlayTime2(info.remaining)}）`
    return '未开启：到点自动暂停，可先试 15 分钟'
  }, [info])

  const actions = useMemo(() => QUICK_MINUTES.map(minutes => ({
    key: `min_${minutes}`,
    label: `${minutes}分`,
    icon: 'timer-outline',
    onPress: () => {
      startSleepTimer(minutes)
      onClose()
    },
  })), [onClose])

  const items = useMemo<ActionSheetItem[]>(() => {
    const list: ActionSheetItem[] = MORE_MINUTES.map(minutes => ({
      key: `min_${minutes}`,
      label: `${minutes} 分钟`,
      icon: 'timer-outline',
      onPress: () => {
        startSleepTimer(minutes)
        onClose()
      },
    }))
    list.push(
      {
        key: 'endOfTrack',
        label: '播完当前曲',
        icon: 'music-note',
        active: info.mode === 'endOfTrack',
        onPress: () => {
          startSleepTimerAtTrackEnd()
          onClose()
        },
      },
    )
    if (info.mode) {
      list.push({
        key: 'cancel',
        label: '取消定时',
        icon: 'timer-off-outline',
        danger: true,
        onPress: () => {
          cancelSleepTimer()
          onClose()
        },
      })
    }
    return list
  }, [info.mode, onClose])

  return (
    <ActionSheet
      visible={visible}
      header={{ title: '定时关闭', subtitle }}
      actions={actions}
      items={items}
      onClose={onClose}
    />
  )
})
