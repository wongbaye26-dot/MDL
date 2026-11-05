import { memo, useCallback, useEffect, useState } from 'react'
import { AppState, TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, isAndroid, toast } from '@/utils/tools'
import { openAppDetailsSettings } from '@/utils/nativeModules/utils'
import {
  getBrandTips,
  openAllFilesAccessGuide,
  openAutoStartGuide,
  openBatteryOptimizationGuide,
  openNotificationGuide,
  readDeviceBrandInfo,
  readDeviceCompatStatus,
  type DeviceBrandInfo,
  type DeviceCompatStatus,
} from '@/core/deviceCompat'

interface RowProps {
  icon: string
  title: string
  desc?: string
  stateText?: string
  stateColor?: string
  onPress?: () => void
}

/**
 * 设备兼容 / 品牌适配设置区块。
 *
 * targetSdk 36（Android 16）之后前台服务、通知、后台播放对权限与厂商后台策略更敏感，
 * 这里把「通知权限 / 所有文件访问 / 电池优化 / 自启动」集中成一个入口，
 * 并按当前厂商展示对应的后台保活提示。
 *
 * 说明：
 *  - 文案先用中文硬编码（不依赖 src/lang，避免与语言包任务冲突）；
 *  - 由 Lead 接入 Other/index.tsx，本文件自身不引用设置页其它文件；
 *  - 任何系统页都打不开时原生会回落应用详情页，不会崩溃。
 */
export default memo(() => {
  const theme = useTheme()
  const [status, setStatus] = useState<DeviceCompatStatus | null>(null)
  const [brandInfo, setBrandInfo] = useState<DeviceBrandInfo | null>(null)

  const refresh = useCallback(async() => {
    if (!isAndroid) return
    const [nextStatus, nextBrandInfo] = await Promise.all([
      readDeviceCompatStatus(),
      readDeviceBrandInfo(),
    ])
    setStatus(nextStatus)
    setBrandInfo(nextBrandInfo)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // 从系统设置页返回时刷新状态（权限/电池优化可能刚被改动）
  useEffect(() => {
    if (!isAndroid) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh()
    })
    return () => {
      subscription.remove()
    }
  }, [refresh])

  const handleNotification = useCallback(async() => {
    const enabled = await openNotificationGuide()
    toast(enabled ? '通知已开启' : '通知未开启：播放控制与下载进度通知将不显示')
    await refresh()
  }, [refresh])

  const handleAllFiles = useCallback(async() => {
    const opened = await openAllFilesAccessGuide()
    if (!opened) toast('未能打开设置页，请到系统设置里手动授予「所有文件访问权限」')
  }, [])

  const handleBattery = useCallback(async() => {
    const ignoring = await openBatteryOptimizationGuide()
    toast(ignoring ? '已允许后台运行' : '未允许后台运行：播放可能被系统清理，可稍后到电池设置里再开')
    await refresh()
  }, [refresh])

  const handleAutoStart = useCallback(async() => {
    const result = await openAutoStartGuide()
    if (!result.opened) {
      toast('未能打开自启动设置，请到系统设置里手动允许 EmoMusic 后台运行')
      return
    }
    toast(result.usedFallback
      ? '已打开应用详情页，部分系统需要在电池/后台管理里手动允许'
      : '已打开自启动管理页，请允许 EmoMusic 自启动与后台运行')
  }, [])

  const handleAppDetails = useCallback(async() => {
    await openAppDetailsSettings()
  }, [])

  if (!isAndroid) return null

  const Row = ({ icon, title, desc, stateText, stateColor, onPress }: RowProps) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      disabled={onPress == null}
      onPress={onPress}
    >
      <View style={{ ...styles.iconWrap, backgroundColor: theme['c-primary-alpha-900'] }}>
        <Icon name={icon} size={17} color={theme['c-primary']} />
      </View>
      <View style={styles.info}>
        <Text size={14} numberOfLines={1}>{title}</Text>
        {desc ? <Text size={11} color={theme['c-450']} numberOfLines={2} style={styles.desc}>{desc}</Text> : null}
      </View>
      {stateText ? <Text size={11} color={stateColor ?? theme['c-450']} style={styles.stateText}>{stateText}</Text> : null}
      {onPress ? <Icon name='chevron-right' size={16} color={theme['c-350']} /> : null}
    </TouchableOpacity>
  )

  const brandTips = getBrandTips(brandInfo?.brandKey ?? 'generic')

  return (
    <>
      <Section title='设备与权限' desc='品牌机型后台保活与系统入口'>
        <Row
          icon='cellphone'
          title={brandInfo?.model ?? '读取设备信息'}
          desc={brandInfo
            ? `${brandInfo.brandName} · ${brandInfo.manufacturer} · Android ${brandInfo.osVersion ?? '-'}（API ${brandInfo.sdkInt}）`
            : '正在读取设备信息…'}
        />
        <Row
          icon='bell-outline'
          title='通知权限'
          desc='播放控制通知、下载进度通知必需（Android 13+ 需手动允许）'
          stateText={status == null ? '检测中…' : status.notificationsEnabled ? '已开启' : '去开启'}
          stateColor={status?.notificationsEnabled ? theme['c-primary'] : theme['c-450']}
          onPress={() => { void handleNotification() }}
        />
        <Row
          icon='folder-open-outline'
          title='所有文件访问权限'
          desc='写入公共 Music 目录、重扫本地曲库需要（Android 11+）'
          stateText={status == null ? '检测中…' : status.allFilesAccess ? '已允许' : '去开启'}
          stateColor={status?.allFilesAccess ? theme['c-primary'] : theme['c-450']}
          onPress={() => { void handleAllFiles() }}
        />
        <Row
          icon='battery-charging-outline'
          title='电池优化'
          desc='允许后台运行，避免锁屏/切后台后播放被系统清理'
          stateText={status == null ? '检测中…' : status.ignoringBatteryOptimization ? '已允许' : '受限'}
          stateColor={status?.ignoringBatteryOptimization ? theme['c-primary'] : theme['c-450']}
          onPress={() => { void handleBattery() }}
        />
        <Row
          icon='rocket-launch-outline'
          title='自启动 / 后台运行'
          desc={brandInfo ? `打开 ${brandInfo.brandName} 的自启动管理页，允许 EmoMusic 后台运行` : '打开厂商自启动管理页'}
          stateText='去设置'
          onPress={() => { void handleAutoStart() }}
        />
        <Row
          icon='cog-outline'
          title='系统应用设置'
          desc='找不到对应入口时，从系统「应用详情页」手动开启'
          onPress={() => { void handleAppDetails() }}
        />
      </Section>
      <Section title='品牌保活提示' desc={brandInfo ? `当前识别：${brandInfo.brandName}` : undefined}>
        <View style={styles.tips}>
          {
            brandTips.map((tip, index) => (
              <View key={index} style={styles.tipRow}>
                <Icon name='information-outline' size={14} color={theme['c-450']} style={styles.tipIcon} />
                <Text size={12} color={theme['c-450']} style={styles.tipText}>{tip}</Text>
              </View>
            ))
          }
          <View style={styles.tipRow}>
            <Icon name='information-outline' size={14} color={theme['c-450']} style={styles.tipIcon} />
            <Text size={12} color={theme['c-450']} style={styles.tipText}>各厂商设置页名称可能随系统版本变化，若跳转失败会自动回落到应用详情页。</Text>
          </View>
        </View>
      </Section>
    </>
  )
})

const styles = createStyle({
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
  stateText: {
    marginRight: 5,
    fontWeight: '600',
  },
  tips: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 7,
  },
  tipIcon: {
    marginTop: 1,
    marginRight: 6,
  },
  tipText: {
    flex: 1,
    lineHeight: 17,
  },
})
