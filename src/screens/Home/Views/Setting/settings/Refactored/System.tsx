import { useCallback, useEffect, useState } from 'react'
import { AppState, View } from 'react-native'
import { Group, ToggleRow, ValueRow } from '../../components/ui'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle, isAndroid, toast } from '@/utils/tools'
import { APP_PERMISSIONS, checkPermission, openAppSettings, requestPermission } from '@/core/permissions'
import { openAppDetailsSettings } from '@/utils/nativeModules/utils'
import {
  getBrandTips,
  openAutoStartGuide,
  openBatteryOptimizationGuide,
  openNotificationGuide,
  readDeviceBrandInfo,
  readDeviceCompatStatus,
  type DeviceBrandInfo,
  type DeviceCompatStatus,
} from '@/core/deviceCompat'
import { Space, Type } from '@/theme/designTokens'

/** 通知与系统（IA 第 9 组）；所有文件访问权限已去重到「下载管理」 */
export default () => {
  const theme = useTheme()
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<DeviceCompatStatus | null>(null)
  const [brandInfo, setBrandInfo] = useState<DeviceBrandInfo | null>(null)

  const refresh = useCallback(async() => {
    const next: Record<string, boolean> = {}
    for (const item of APP_PERMISSIONS) next[item.key] = await checkPermission(item)
    setPermissions(next)
    if (!isAndroid) return
    const [s, brand] = await Promise.all([readDeviceCompatStatus(), readDeviceBrandInfo()])
    setStatus(s)
    setBrandInfo(brand)
  }, [])

  useEffect(() => {
    void refresh()
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void refresh() })
    return () => { sub.remove() }
  }, [refresh])

  const request = async(item: typeof APP_PERMISSIONS[number]) => {
    if (!item.android) { openAppSettings(); return }
    const granted = await requestPermission(item)
    if (!granted) toast('未获得授权，可以到系统设置里手动开启')
    await refresh()
  }

  const brandTips = getBrandTips(brandInfo?.brandKey ?? 'generic')

  return (
    <View>
      <Group
        title='通知与系统'
        desc='缺失权限会导致扫描不到音乐或没有播放通知'
        footer={(
          <View style={styles.tips}>
            {brandTips.map((tip, index) => (
              <Text key={index} size={Type.caption.fontSize} color={theme['c-450']} style={styles.tip}>· {tip}</Text>
            ))}
            <Text size={Type.caption.fontSize} color={theme['c-450']} style={styles.tip}>· 各厂商设置页名称可能随系统版本变化，跳转失败会自动回落到应用详情页。</Text>
          </View>
        )}
      >
        {APP_PERMISSIONS.map(item => (
          <ValueRow
            key={item.key}
            title={item.label}
            desc={item.desc}
            value={permissions[item.key] ? '已开启' : '去开启'}
            onPress={() => { void request(item) }}
          />
        ))}
        <ValueRow title='系统权限设置' desc='被永久拒绝后只能在这里手动开启' value='打开' onPress={openAppSettings} />
        <ValueRow
          title='通知权限'
          desc='播放控制通知、下载进度通知必需'
          value={status == null ? '检测中…' : status.notificationsEnabled ? '已开启' : '去开启'}
          onPress={() => { void openNotificationGuide().then(enabled => { toast(enabled ? '通知已开启' : '通知未开启'); void refresh() }) }}
        />
        <ValueRow
          title='电池优化'
          desc='允许后台运行，避免锁屏后播放被清理'
          value={status == null ? '检测中…' : status.ignoringBatteryOptimization ? '已允许' : '受限'}
          onPress={() => { void openBatteryOptimizationGuide().then(ignoring => { toast(ignoring ? '已允许后台运行' : '未允许后台运行'); void refresh() }) }}
        />
        <ValueRow
          title='自启动 / 后台运行'
          desc='打开厂商自启动管理页'
          value='去设置'
          onPress={() => { void openAutoStartGuide().then(result => { toast(result.opened ? '已打开自启动管理页' : '未能打开设置页') }) }}
        />
        <ValueRow title='系统应用设置' desc='找不到入口时从应用详情页手动开启' value='打开' onPress={() => { void openAppDetailsSettings() }} />
        <ToggleRow settingKey='player.isShowNotificationImage' title='通知栏显示封面' desc='关闭后通知只显示文字与图标' />
      </Group>
    </View>
  )
}

const styles = createStyle({
  tips: {
    paddingLeft: Space.lg,
    paddingRight: Space.lg,
    paddingTop: Space.sm,
    paddingBottom: Space.md,
  },
  tip: {
    lineHeight: 18,
    marginBottom: Space.xs,
  },
})
