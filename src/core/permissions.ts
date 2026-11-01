import { Linking, PermissionsAndroid, Platform } from 'react-native'

import { getData, saveData } from '@/plugins/storage'

const PROMPTED_KEY = 'startup_permission_prompted'

export interface PermissionItem {
  key: string
  label: string
  desc: string
  /** Android 权限名，iOS 为空 */
  android?: string
}

/** 应用实际需要的主要权限（设置页里展示用） */
export const APP_PERMISSIONS: PermissionItem[] = [
  {
    key: 'media',
    label: '音乐和音频',
    desc: '扫描本地音乐、读取歌曲标签和封面',
    android: Platform.Version >= 33
      ? 'android.permission.READ_MEDIA_AUDIO'
      : 'android.permission.READ_EXTERNAL_STORAGE',
  },
  {
    key: 'notification',
    label: '通知',
    desc: '显示播放控制通知、下载进度',
    android: Platform.Version >= 33 ? 'android.permission.POST_NOTIFICATIONS' : undefined,
  },
  {
    key: 'storage',
    label: '文件与目录',
    desc: '通过系统文件选择器添加音乐文件夹（由系统单独授权，不在这里）',
  },
]

export const checkPermission = async(item: PermissionItem): Promise<boolean> => {
  if (Platform.OS !== 'android' || !item.android) return true
  try {
    return await PermissionsAndroid.check(item.android as never)
  } catch {
    return false
  }
}

export const requestPermission = async(item: PermissionItem): Promise<boolean> => {
  if (Platform.OS !== 'android' || !item.android) return true
  try {
    const res = await PermissionsAndroid.request(item.android as never)
    return res === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

/** 打开系统里本应用的权限设置页 */
export const openAppSettings = () => {
  void Linking.openSettings()
}

/**
 * 首次启动申请一次权限（音乐和音频 + 通知）。
 * 只弹一次：之后交给「设置 → 其他 → 权限管理」里的手动入口。
 */
export const requestStartupPermissions = async() => {
  if (Platform.OS !== 'android') return
  const prompted = await getData<boolean>(PROMPTED_KEY)
  if (prompted) return
  await saveData(PROMPTED_KEY, true)
  const targets = APP_PERMISSIONS.filter(item => !!item.android)
  for (const item of targets) {
    const granted = await checkPermission(item)
    if (!granted) await requestPermission(item)
  }
}
