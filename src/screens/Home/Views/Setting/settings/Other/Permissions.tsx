import { memo, useCallback, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { APP_PERMISSIONS, checkPermission, openAppSettings, requestPermission, type PermissionItem } from '@/core/permissions'

const ICONS: Record<string, string> = {
  media: 'music-note',
  notification: 'bell-outline',
  storage: 'folder-outline',
}

/** 权限管理：和设置里其它卡片同一套语言（左侧图标 + 标题/描述 + 右侧状态） */
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

  const Row = ({ item }: { item: PermissionItem }) => {
    const granted = status[item.key]
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => { void handlePress(item) }}>
        <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-900'] }}>
          <Icon name={ICONS[item.key] ?? 'shield-check-outline'} size={17} color={theme['c-primary']} />
        </View>
        <View style={styles.info}>
          <Text size={14} numberOfLines={1}>{item.label}</Text>
          <Text size={11} color={theme['c-450']} numberOfLines={2} style={styles.desc}>{item.desc}</Text>
        </View>
        {
          item.android
            ? (
              <View style={styles.state}>
                <Icon
                  name={granted ? 'check-circle' : 'alert-circle-outline'}
                  size={16}
                  color={granted ? theme['c-primary'] : theme['c-400']}
                />
                <Text size={10} color={granted ? theme['c-primary'] : theme['c-450']} style={styles.stateText}>
                  {granted ? '已开启' : '去开启'}
                </Text>
              </View>
              )
            : <Icon name='chevron-right' size={16} color={theme['c-350']} />
        }
      </TouchableOpacity>
    )
  }

  return (
    <Section title='权限管理' desc='缺失权限会导致扫描不到音乐 / 没有播放通知'>
      <View style={styles.list}>
        {APP_PERMISSIONS.map(item => <Row key={item.key} item={item} />)}
        <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={openAppSettings}>
          <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-900'] }}>
            <Icon name='cog-outline' size={17} color={theme['c-primary']} />
          </View>
          <View style={styles.info}>
            <Text size={14}>系统权限设置</Text>
            <Text size={11} color={theme['c-450']} numberOfLines={1} style={styles.desc}>被永久拒绝后只能在这里手动开启</Text>
          </View>
          <Icon name='chevron-right' size={16} color={theme['c-350']} />
        </TouchableOpacity>
      </View>
    </Section>
  )
})

const styles = createStyle({
  list: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  info: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  desc: {
    marginTop: 2,
    lineHeight: 15,
  },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateText: {
    marginLeft: 3,
    fontWeight: '600',
  },
})
