import { memo, useCallback, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { APP_PERMISSIONS, checkPermission, openAppSettings, requestPermission, type PermissionItem } from '@/core/permissions'

/** 权限管理：列出应用需要的主要权限，可单独申请或跳到系统设置 */
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
    if (!granted) {
      toast('未获得授权，可以到系统设置里手动开启')
    }
    await refresh()
  }, [refresh])

  return (
    <Section title='权限管理'>
      <View style={styles.list}>
        {
          APP_PERMISSIONS.map(item => {
            const granted = status[item.key]
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => { void handlePress(item) }}
              >
                <View style={styles.info}>
                  <Text size={14}>{item.label}</Text>
                  <Text size={11} color={theme['c-450']} style={styles.desc}>{item.desc}</Text>
                </View>
                {
                  item.android
                    ? (
                      <View style={{ ...styles.badge, backgroundColor: granted ? theme['c-primary-alpha-900'] : theme['c-primary'] }}>
                        <Text size={10} color={granted ? theme['c-primary'] : '#FFFFFF'} style={styles.badgeText}>
                          {granted ? '已授权' : '去授权'}
                        </Text>
                      </View>
                      )
                    : <Icon name='chevron-right' size={16} color={theme['c-350']} />
                }
              </TouchableOpacity>
            )
          })
        }
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={openAppSettings}>
          <View style={styles.info}>
            <Text size={14}>打开系统权限设置</Text>
            <Text size={11} color={theme['c-450']} style={styles.desc}>被永久拒绝时，只能在系统设置里手动开启</Text>
          </View>
          <Icon name='chevron-right' size={16} color={theme['c-350']} />
        </TouchableOpacity>
      </View>
    </Section>
  )
})

const styles = createStyle({
  list: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  desc: {
    marginTop: 3,
    lineHeight: 16,
  },
  badge: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontWeight: '600',
  },
})
