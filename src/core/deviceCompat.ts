/**
 * 品牌兼容工具。
 *
 * 目标：让「通知权限 / 所有文件访问 / 电池优化 / 自启动」这些系统入口，
 * 在不同厂商 ROM（小米、华为/荣耀、OPPO/一加/realme、vivo/iQOO、三星、魅族）上
 * 都能尽量一步跳到对应页面；厂商页面不存在时由原生依次 fallback，
 * 最后回落到系统「应用详情页」，任何一步失败都不会抛异常 / 崩溃。
 *
 * 原生实现见 android/.../utils/UtilsModule.java：
 *  - getDeviceCompatInfo / getManufacturer / getBrand / getModel
 *  - openAutoStartSettings（品牌 intent 链式 fallback，返回 { opened, target }）
 *  - openAppDetailsSettings
 */
import {
  getDeviceCompatInfo,
  isExternalStorageManager,
  isIgnoringBatteryOptimization,
  isNotificationsEnabled,
  openAllFilesAccessSettings,
  openAppDetailsSettings,
  openAutoStartSettings,
  requestIgnoreBatteryOptimization,
  requestNotificationPermission,
  type DeviceCompatInfo,
  type OpenAutoStartResult,
} from '@/utils/nativeModules/utils'

export type DeviceBrandKey = 'xiaomi' | 'huawei' | 'oppo' | 'vivo' | 'samsung' | 'meizu' | 'generic'

interface BrandMatcher {
  key: DeviceBrandKey
  name: string
  keywords: string[]
}

const BRAND_MATCHERS: BrandMatcher[] = [
  { key: 'xiaomi', name: '小米 / 红米', keywords: ['xiaomi', 'redmi', 'poco'] },
  { key: 'huawei', name: '华为 / 荣耀', keywords: ['huawei', 'honor', 'harmony'] },
  { key: 'oppo', name: 'OPPO / 一加 / realme', keywords: ['oppo', 'oneplus', 'realme', 'oplus'] },
  { key: 'vivo', name: 'vivo / iQOO', keywords: ['vivo', 'iqoo'] },
  { key: 'samsung', name: '三星', keywords: ['samsung'] },
  { key: 'meizu', name: '魅族', keywords: ['meizu', 'mblu'] },
]

export interface DeviceBrandInfo extends DeviceCompatInfo {
  brandKey: DeviceBrandKey
  brandName: string
}

/** 由 Build.MANUFACTURER / Build.BRAND 判断厂商归类（只用于文案与 intent 选择，不用于功能开关） */
export const getDeviceBrandKey = (info: Pick<DeviceCompatInfo, 'manufacturer' | 'brand'>): DeviceBrandKey => {
  const name = `${info.manufacturer}/${info.brand}`.toLowerCase()
  const matcher = BRAND_MATCHERS.find(item => item.keywords.some(keyword => name.includes(keyword)))
  return matcher?.key ?? 'generic'
}

export const getBrandName = (key: DeviceBrandKey): string => {
  return BRAND_MATCHERS.find(item => item.key === key)?.name ?? '其它品牌'
}

/** 读取设备品牌信息（原生缺失时返回空值 + generic，不抛异常） */
export const readDeviceBrandInfo = async(): Promise<DeviceBrandInfo> => {
  const info = await getDeviceCompatInfo()
  const brandKey = getDeviceBrandKey(info)
  return {
    ...info,
    brandKey,
    brandName: getBrandName(brandKey),
  }
}

/** 各品牌「后台保活」注意事项，直接展示在设置页 */
export const getBrandTips = (key: DeviceBrandKey): string[] => {
  switch (key) {
    case 'xiaomi':
      return [
        '自启动：设置 → 应用设置 → 授权管理 → 自启动，允许 EmoMusic',
        '省电策略：应用信息 → 省电策略 → 选择「无限制」，否则后台播放会被清理',
        '通知：应用信息 → 通知管理，允许通知与锁屏通知，播放控制才能常驻',
      ]
    case 'huawei':
      return [
        '应用启动管理：设置 → 应用 → 应用启动管理，关闭 EmoMusic 的「自动管理」并允许自启动/后台活动',
        '电池优化：应用信息 → 耗电详情，允许后台活动',
        '通知：应用信息 → 通知管理，允许通知与锁屏通知',
      ]
    case 'oppo':
      return [
        '自启动：设置 → 应用 → 自启动管理，允许 EmoMusic 自启动',
        '耗电管理：应用信息 → 耗电管理，允许「后台运行」与「自动启动」',
        '通知：应用信息 → 通知管理，允许通知与锁屏通知',
      ]
    case 'vivo':
      return [
        '自启动：设置 → 应用与权限 → 权限管理 → 自启动，允许 EmoMusic',
        '后台高耗电：设置 → 电池 → 后台耗电管理，允许 EmoMusic 后台高耗电',
        '通知：应用信息 → 通知，允许通知与锁屏通知',
      ]
    case 'samsung':
      return [
        '电池：设置 → 电池 → 后台使用限制，把 EmoMusic 移出「休眠应用」',
        '通知：设置 → 通知 → 应用通知，允许 EmoMusic 通知',
        '若通知栏不显示播放控制：检查「设置 → 应用 → EmoMusic → 电池 → 不受限制」',
      ]
    case 'meizu':
      return [
        '自启动：设置 → 应用管理 → 权限管理 → 自启动，允许 EmoMusic',
        '后台：应用信息 → 耗电管理，允许后台运行',
        '通知：应用信息 → 通知，允许通知与锁屏通知',
      ]
    default:
      return [
        '在系统设置里允许 EmoMusic 显示通知，否则播放控制与下载进度通知不显示',
        '在「电池 / 省电」设置里允许 EmoMusic 后台运行，避免播放中被清理',
        '部分系统还有「自启动」开关，建议一并打开',
      ]
  }
}

export interface DeviceCompatStatus {
  notificationsEnabled: boolean
  allFilesAccess: boolean
  ignoringBatteryOptimization: boolean
}

/** 读取三项关键权限/后台状态（任何一项失败都按「未开启」处理，不抛异常） */
export const readDeviceCompatStatus = async(): Promise<DeviceCompatStatus> => {
  const [notificationsEnabled, allFilesAccess, ignoringBatteryOptimization] = await Promise.all([
    isNotificationsEnabled().catch(() => false),
    isExternalStorageManager(),
    isIgnoringBatteryOptimization().catch(() => false),
  ])
  return {
    notificationsEnabled,
    allFilesAccess,
    ignoringBatteryOptimization,
  }
}

/** 引导开启通知：先跳系统通知设置页，用户返回后返回「当前是否已开启」；入口打不开时回落应用详情页 */
export const openNotificationGuide = async(): Promise<boolean> => {
  try {
    return await requestNotificationPermission()
  } catch {
    return openAppDetailsSettings()
  }
}

/** 打开「所有文件访问权限」设置页（失败时退回应用详情页） */
export const openAllFilesAccessGuide = async(): Promise<boolean> => {
  const opened = await openAllFilesAccessSettings()
  if (opened) return true
  return openAppDetailsSettings()
}

/** 请求忽略电池优化（系统弹窗）；失败时退回应用详情页 */
export const openBatteryOptimizationGuide = async(): Promise<boolean> => {
  try {
    const opened = await requestIgnoreBatteryOptimization()
    if (opened) return true
  } catch {}
  return openAppDetailsSettings()
}

export interface AutoStartGuideResult extends OpenAutoStartResult {
  /** 是否使用了「应用详情页」兜底 */
  usedFallback: boolean
}

/** 打开厂商自启动管理页；原生已做品牌 intent 链式 fallback，最后回落应用详情页 */
export const openAutoStartGuide = async(): Promise<AutoStartGuideResult> => {
  const result = await openAutoStartSettings()
  return {
    ...result,
    usedFallback: result.target === 'appDetails' || result.target === 'none',
  }
}
