import { AppState, NativeEventEmitter, NativeModules } from 'react-native'

const { UtilsModule } = NativeModules

/** 系统栏 inset，单位 px（除以 WindowInsetsInfo.density 即 dp） */
export interface EdgeInsets {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * 原生 getWindowInsets() 的返回值。
 * 单位统一为 px；density 用来换算 dp。分屏 / 小窗 / 折叠屏形态、手势/三键导航切换时会变。
 */
export interface WindowInsetsInfo {
  density: number
  statusBars: EdgeInsets
  navigationBars: EdgeInsets
  systemBars: EdgeInsets
  /** 挖孔安全区 */
  cutout: EdgeInsets
  /** 键盘；adjustResize 生效时可能为 0 */
  ime: EdgeInsets
  /** 分屏 / 小窗 / 画中画 */
  isInMultiWindowMode: boolean
}

/** 原生 screen-size-changed 事件负载：可用区域（dp + px）+ insets（px） */
export interface WindowMetrics extends WindowInsetsInfo {
  /** 可用区域宽高，单位 dp（与 RN 的 Dimensions.window 一致） */
  width: number
  height: number
  /** 可用区域宽高，单位 px */
  pixelWidth: number
  pixelHeight: number
}

/** 设备品牌/系统信息（品牌兼容引导用） */
export interface DeviceCompatInfo {
  manufacturer: string
  brand: string
  model: string
  device: string
  osVersion: string
  sdkInt: number
}

/** 打开厂商自启动设置页的结果 */
export interface OpenAutoStartResult {
  opened: boolean
  /** 实际打开的入口：厂商包名 / 'appDetails' / 'none' */
  target: string
}

const emptyEdgeInsets = (): EdgeInsets => ({ top: 0, bottom: 0, left: 0, right: 0 })

/** 兜底的空 insets（原生方法缺失或 Activity 未就绪时） */
export const emptyWindowInsets = (): WindowInsetsInfo => ({
  density: 1,
  statusBars: emptyEdgeInsets(),
  navigationBars: emptyEdgeInsets(),
  systemBars: emptyEdgeInsets(),
  cutout: emptyEdgeInsets(),
  ime: emptyEdgeInsets(),
  isInMultiWindowMode: false,
})

export const exitApp = UtilsModule.exitApp

export const getSupportedAbis = UtilsModule.getSupportedAbis

export const installApk = (filePath: string, fileProviderAuthority: string) => UtilsModule.installApk(filePath, fileProviderAuthority)


export const screenkeepAwake = () => {
  if (global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = true
  UtilsModule.screenkeepAwake()
}
export const screenUnkeepAwake = () => {
  // console.log('screenUnkeepAwake')
  if (!global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = false
  UtilsModule.screenUnkeepAwake()
}

export const getWIFIIPV4Address = UtilsModule.getWIFIIPV4Address as () => Promise<string>

export const getDeviceName = async(): Promise<string> => {
  return UtilsModule.getDeviceName().then((deviceName: string) => deviceName || 'Unknown')
}


/** 是否已授予「所有文件访问权限」（Android 11+ 写公共 Music 目录必需） */
export const isExternalStorageManager = async(): Promise<boolean> => {
  try { return await UtilsModule.isExternalStorageManager() } catch { return false }
}

/** 打开系统「所有文件访问权限」设置页 */
export const openAllFilesAccessSettings = async(): Promise<boolean> => {
  try { return await UtilsModule.openAllFilesAccessSettings() } catch { return false }
}

export const isNotificationsEnabled = async(): Promise<boolean> => {
  try { return await UtilsModule.isNotificationsEnabled() as boolean } catch { return false }
}

export const requestNotificationPermission = async() => new Promise<boolean>((resolve) => {
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isNotificationsEnabled().then(resolve)
    }, 1000)
  })
  UtilsModule.openNotificationPermissionActivity().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  })
})

export const shareText = async(shareTitle: string, title: string, text: string): Promise<void> => {
  UtilsModule.shareText(shareTitle, title, text)
}

export const getSystemLocales = async(): Promise<string> => {
  return UtilsModule.getSystemLocales()
}

export const onScreenStateChange = (handler: (state: 'ON' | 'OFF') => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-state', event => {
    handler(event.state as 'ON' | 'OFF')
  })

  return () => {
    eventListener.remove()
  }
}

export const getWindowSize = async(): Promise<{ width: number, height: number }> => {
  // Activity 未就绪 / 原生方法缺失时返回 0，避免启动阶段 Promise 链断掉
  try { return await UtilsModule.getWindowSize() as { width: number, height: number } } catch { return { width: 0, height: 0 } }
}

/**
 * 设置原生窗口底色，切换主题时调用，避免重渲染首帧露出系统白/黑底
 * @param color #RRGGBB / #AARRGGBB
 */
export const setWindowBackgroundColor = (color: string) => {
  try {
    UtilsModule.setWindowBackgroundColor?.(color)
  } catch {}
}

/** 读取系统 Material You 主题色，失败返回 null */export const getSystemAccentColor = async(): Promise<string | null> => {
  try {
    return await UtilsModule.getSystemAccentColor() as string | null
  } catch {
    return null
  }
}

/** 读取系统 Material You 色板（accent1~3 / neutral1~2），Android 12 以下为空对象 */
export const getSystemColorPalette = async(): Promise<Record<string, string[]>> => {
  try {
    return await UtilsModule.getSystemColorPalette() as Record<string, string[]>
  } catch {
    return {}
  }
}

/**
 * 监听窗口可用区域变化（分屏 / 小窗 / 折叠屏 / 导航栏模式切换）。
 *
 * Android 15/16 强制 edge-to-edge 后，RN 自带的 Dimensions 在自由窗口拖动尺寸时
 * 不一定刷新（RN 0.73 只在旋转时重新读 DisplayMetrics），所以由原生 decor 的
 * layout 回调 + MainActivity 的 insets 回调主动推 screen-size-changed。
 */
export const onWindowSizeChange = (handler: (metrics: WindowMetrics) => void): () => void => {
  try {
    UtilsModule.listenWindowSizeChanged?.()
  } catch {}
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-size-changed', (event: WindowMetrics) => {
    handler(event)
  })

  return () => {
    eventListener.remove()
  }
}

/** 读取当前窗口 insets / 是否处于分屏小窗，单位 px（除以 density 即 dp） */
export const getWindowInsets = async(): Promise<WindowInsetsInfo> => {
  try {
    const insets = await UtilsModule.getWindowInsets() as WindowInsetsInfo | null
    if (!insets?.statusBars) return emptyWindowInsets()
    return insets
  } catch {
    return emptyWindowInsets()
  }
}

/** 设备品牌/系统信息，用于品牌兼容引导 */
export const getDeviceCompatInfo = async(): Promise<DeviceCompatInfo> => {
  const fallback: DeviceCompatInfo = {
    manufacturer: '',
    brand: '',
    model: '',
    device: '',
    osVersion: '',
    sdkInt: 0,
  }
  try {
    const info = await UtilsModule.getDeviceCompatInfo() as DeviceCompatInfo | null
    return info ?? fallback
  } catch {
    return fallback
  }
}

export const getManufacturer = async(): Promise<string> => {
  try {
    return await UtilsModule.getManufacturer() as string
  } catch {
    return ''
  }
}

export const getBrand = async(): Promise<string> => {
  try {
    return await UtilsModule.getBrand() as string
  } catch {
    return ''
  }
}

export const getModel = async(): Promise<string> => {
  try {
    return await UtilsModule.getModel() as string
  } catch {
    return ''
  }
}

/**
 * 打开厂商「自启动 / 后台运行」管理页，失败自动回落应用详情页（不会抛异常）。
 * 返回 { opened, target }；opened=false 表示连应用详情页都打不开。
 */
export const openAutoStartSettings = async(): Promise<OpenAutoStartResult> => {
  try {
    const result = await UtilsModule.openAutoStartSettings() as OpenAutoStartResult | null
    return result ?? { opened: false, target: 'none' }
  } catch {
    return { opened: false, target: 'none' }
  }
}

/** 打开系统「应用详情页」（权限/通知/存储入口的最终兜底） */
export const openAppDetailsSettings = async(): Promise<boolean> => {
  try {
    return await UtilsModule.openAppDetailsSettings() as boolean
  } catch {
    return false
  }
}

export const isIgnoringBatteryOptimization = async(): Promise<boolean> => {
  return UtilsModule.isIgnoringBatteryOptimization()
}

export const requestIgnoreBatteryOptimization = async() => new Promise<boolean>((resolve) => {
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isIgnoringBatteryOptimization().then(resolve)
    }, 1000)
  })
  UtilsModule.requestIgnoreBatteryOptimization().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  })
})
