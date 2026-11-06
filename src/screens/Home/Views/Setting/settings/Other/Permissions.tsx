import { memo, useCallback, useEffect, useState } from 'react'

import Section from '../../components/Section'
import SettingRow from '../../components/SettingRow'
import Tag from '@/components/common/Tag'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { toast } from '@/utils/tools'
import { APP_PERMISSIONS, checkPermission, openAppSettings, requestPermission, type PermissionItem } from '@/core/permissions'

const ICONS: Record<string, string> = {
  media: 'music-note',
  notification: 'bell-outline',
  storage: 'folder-outline',
}

/**
 * 权限管理：统一成设置页通用行（左图标 + 标题/描述 + 右侧状态 Tag）。
 * 系统权限页本身改不了样式，这里只统一 App 内的入口页。
 */
export default memo(() => {
  const theme = useTheme()
  const [status, setStatus] = useState<Record<string, boolean>>({})

  const refresh = useCallback(async() => {
    const next: Record<string, boolean> = {}
    for (const item of APP_PERMISSIONS) next[item.key] = await checkPermission(item)
    setStatus(next)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const handlePress = useCallback(async(item: PermissionItem) => {
    if (!item.android) {
      openAppSettings()
      return
    }
    const granted = await requestPermission(item)
    if (!granted) toast('未获得授权，可以到系统设置里手动开启')
    await refresh()
  }, [refresh])

  return (
    <Section title='权限管理' icon='shield-check-outline' desc='缺失权限会导致扫描不到音乐 / 没有播放通知'>
      {
        APP_PERMISSIONS.map(item => {
          const granted = status[item.key]
          return (
            <SettingRow
              key={item.key}
              icon={ICONS[item.key] ?? 'shield-check-outline'}
              title={item.label}
              desc={item.desc}
              onPress={() => { void handlePress(item) }}
              right={item.android
                ? (
                  <Tag
                    label={granted ? '已开启' : '去开启'}
                    size='sm'
                    tone={granted ? 'success' : 'muted'}
                  />
                  )
                : <Icon name='chevron-right' size={16} color={theme['c-350']} />}
            />
          )
        })
      }
      <SettingRow
        icon='cog-outline'
        title='系统权限设置'
        desc='被永久拒绝后只能在这里手动开启'
        onPress={openAppSettings}
        right={<Icon name='chevron-right' size={16} color={theme['c-350']} />}
      />
    </Section>
  )
})
