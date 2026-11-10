import { memo, useMemo } from 'react'

import ActionSheet, { type ActionSheetItem } from '@/components/common/ActionSheet'
import { connectCastDevice, disconnectCast, useCast } from '@/core/cast'

/**
 * 播放器「投屏到电视」面板。
 *
 * 设备来自 DLNA 搜索（SSDP + 设备描述），列表实时增量补齐；
 * 没搜到设备时面板只显示搜索中的提示，播放器右上角的投屏入口也不会出现。
 */
export default memo(({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const cast = useCast()

  const subtitle = useMemo(() => {
    if (cast.connected && cast.device) return `正在投屏到 ${cast.device.name}`
    if (cast.searching && cast.devices.length == 0) return '正在搜索同一 Wi-Fi 下的电视…'
    if (cast.devices.length == 0) return '没有找到可投屏的设备，请确认电视和手机在同一 Wi-Fi'
    return `找到 ${cast.devices.length} 台设备，点击开始投屏`
  }, [cast.connected, cast.device, cast.searching, cast.devices.length])

  const items = useMemo<ActionSheetItem[]>(() => {
    const list: ActionSheetItem[] = cast.devices.map(device => ({
      key: device.id,
      label: device.name || device.model || '未知设备',
      icon: 'cast',
      active: cast.connected && cast.device?.id === device.id,
      onPress: () => {
        if (cast.connected && cast.device?.id === device.id) {
          onClose()
          return
        }
        connectCastDevice(device.id)
        onClose()
      },
    }))

    if (cast.connected) {
      list.push({
        key: 'disconnect',
        label: '断开投屏',
        icon: 'cast-off',
        danger: true,
        onPress: () => {
          disconnectCast()
          onClose()
        },
      })
    }

    return list
  }, [cast.connected, cast.device, cast.devices, onClose])

  return (
    <ActionSheet
      visible={visible}
      header={{ title: cast.connected ? '投屏中' : '投屏到电视', subtitle }}
      items={items}
      onClose={onClose}
    />
  )
})
